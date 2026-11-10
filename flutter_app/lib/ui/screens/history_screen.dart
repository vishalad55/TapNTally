import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/dates.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../widgets/domain.dart';
import '../widgets/kit.dart';
import '../widgets/pages.dart';

enum DateRange {
  month('This month'),
  lastMonth('Last month'),
  quarter('3 months'),
  all('All time');

  const DateRange(this.label);
  final String label;
}

enum AmountRange {
  any('Any amount'),
  under500('Under ₹500'),
  mid('₹500–2k'),
  over2k('Over ₹2k');

  const AmountRange(this.label);
  final String label;
}

class HistoryFilters {
  const HistoryFilters({this.amount = AmountRange.any, this.categoryId, this.method, this.source});
  final AmountRange amount;
  final String? categoryId;
  final PaymentMethod? method;
  final TransactionSource? source;

  int get count => [amount != AmountRange.any, categoryId != null, method != null, source != null].where((b) => b).length;
}

/// Search & filter, modelled on familiar wallet/order-history patterns.
class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _q = '';
  DateRange _range = DateRange.month;
  HistoryFilters _filters = const HistoryFilters();
  bool _household = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () => setState(() => _q = v.trim()));
    setState(() {}); // update clear button
  }

  TransactionQuery get _query {
    final now = DateTime.now();
    final (from, to) = switch (_range) {
      DateRange.month => (startOfMonth(now), null),
      DateRange.lastMonth => (DateTime(now.year, now.month - 1), startOfMonth(now)),
      DateRange.quarter => (now.subtract(const Duration(days: 90)), null),
      DateRange.all => (null, null),
    };
    final (min, max) = switch (_filters.amount) {
      AmountRange.under500 => (null, 49999),
      AmountRange.mid => (50000, 200000),
      AmountRange.over2k => (200001, null),
      AmountRange.any => (null, null),
    };
    // Day-precision bounds keep the query (and its cache key) stable across rebuilds.
    return TransactionQuery(
      q: _q.isEmpty ? null : _q,
      categoryIds: _filters.categoryId == null ? null : [_filters.categoryId!],
      paymentMethods: _filters.method == null ? null : [_filters.method!],
      sources: _filters.source == null ? null : [_filters.source!],
      minPaise: min,
      maxPaise: max,
      from: from == null ? null : DateTime(from.year, from.month, from.day),
      to: to,
      scope: _household ? 'shared' : 'personal',
      limit: 40,
    );
  }

  Future<void> _openFilters() async {
    final next = await showModalBottomSheet<HistoryFilters>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _FilterSheet(initial: _filters),
    );
    if (next != null) setState(() => _filters = next);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final user = ref.watch(currentUserProvider);
    final query = _query;
    final feed = ref.watch(feedProvider(query));

    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (n.metrics.pixels > n.metrics.maxScrollExtent - 400) ref.read(feedProvider(query).notifier).loadMore();
        return false;
      },
      child: TabPage(
        onRefresh: () async => ref.invalidate(feedProvider(query)),
        slivers: [
          SliverToBoxAdapter(
            child: TabHeader(
              title: 'History',
              eyebrow: 'All purchases',
              trailing: user?.householdId == null
                  ? null
                  : TallyChip(
                      label: _household ? 'Household' : 'Mine',
                      icon: _household ? Icons.people_outline_rounded : Icons.person_outline_rounded,
                      selected: _household,
                      onTap: () => setState(() => _household = !_household),
                    ),
            ),
          ),
          SliverToBoxAdapter(
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    onChanged: _onSearch,
                    autocorrect: false,
                    textInputAction: TextInputAction.search,
                    style: TextStyles.body.copyWith(color: c.ink),
                    decoration: InputDecoration(
                      hintText: 'Search merchants',
                      prefixIcon: const Icon(Icons.search_rounded, size: 20),
                      suffixIcon: _search.text.isEmpty
                          ? null
                          : IconButton(
                              tooltip: 'Clear search',
                              icon: const Icon(Icons.close_rounded, size: 20),
                              onPressed: () {
                                _search.clear();
                                _onSearch('');
                              },
                            ),
                    ),
                  ),
                ),
                const SizedBox(width: Space.xs),
                _FilterButton(count: _filters.count, onTap: _openFilters),
              ],
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: Space.sm),
              child: Wrap(
                spacing: Space.xs,
                runSpacing: Space.xs,
                children: [for (final r in DateRange.values) TallyChip(label: r.label, selected: _range == r, onTap: () => setState(() => _range = r))],
              ),
            ),
          ),
          if (_filters.count > 0)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(top: Space.xs),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: () => setState(() => _filters = const HistoryFilters()),
                    icon: Icon(Icons.filter_alt_off_outlined, size: 16, color: c.accent),
                    label: Text(
                      'Clear ${_filters.count} filter${_filters.count == 1 ? '' : 's'}',
                      style: TextStyles.caption.copyWith(color: c.accent, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ),
            ),
          ..._results(feed),
        ],
      ),
    );
  }

  List<Widget> _results(AsyncValue<FeedState> feed) {
    final c = context.colors;
    if (feed.isLoading && !feed.hasValue) return const [SliverToBoxAdapter(child: LoadingBlock(height: 200))];
    if (feed.hasError && !feed.hasValue) {
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: Space.md),
            child: ErrorCard(message: "Couldn't search right now.", onRetry: () => ref.invalidate(feedProvider)),
          ),
        ),
      ];
    }
    final f = feed.requireValue;
    if (f.items.isEmpty) {
      return const [
        SliverToBoxAdapter(
          child: EmptyState(icon: Icons.search_off_rounded, title: 'No matches', body: 'Try a different merchant name or loosen a filter.'),
        ),
      ];
    }

    final rows = <Widget>[];
    String? lastDay;
    for (final tx in f.items) {
      final d = tx.occurredAt.toLocal();
      final key = '${d.year}-${d.month}-${d.day}';
      if (key != lastDay) {
        rows.add(
          Padding(
            padding: EdgeInsets.only(top: lastDay == null ? Space.xs : Space.lg, bottom: Space.xxs),
            child: Text(dayLabel(d).toUpperCase(), style: TextStyles.micro.copyWith(color: c.inkFaint)),
          ),
        );
        lastDay = key;
      }
      rows.add(TransactionTile(tx: tx, timeOnly: true, onTap: () => context.push('/transaction/${tx.id}')));
    }

    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.only(top: Space.md),
          child: Text('${f.total} result${f.total == 1 ? '' : 's'}', style: TextStyles.caption.copyWith(color: c.inkFaint)),
        ),
      ),
      SliverList.list(children: rows),
      if (f.loadingMore) const SliverToBoxAdapter(child: LoadingBlock(height: 72)),
    ];
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.count, required this.onTap});
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final active = count > 0;
    return Tooltip(
      message: 'Filters',
      excludeFromSemantics: true,
      child: Semantics(
        button: true,
        label: active ? 'Filters, $count active' : 'Filters',
        excludeSemantics: true,
        child: Material(
          color: active ? c.accent : c.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Radii.md),
            side: BorderSide(color: active ? c.accent : c.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              width: 52,
              height: 50,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Icon(Icons.tune_rounded, color: active ? c.accentInk : c.ink),
                  if (active)
                    Positioned(
                      top: 6,
                      right: 6,
                      child: Container(
                        width: 16,
                        height: 16,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: c.accentInk, shape: BoxShape.circle),
                        child: Text('$count', style: TextStyles.micro.copyWith(color: c.accent, fontSize: 10, height: 1)),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FilterSheet extends ConsumerStatefulWidget {
  const _FilterSheet({required this.initial});
  final HistoryFilters initial;

  @override
  ConsumerState<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<_FilterSheet> {
  late AmountRange _amount = widget.initial.amount;
  late String? _category = widget.initial.categoryId;
  late PaymentMethod? _method = widget.initial.method;
  late TransactionSource? _source = widget.initial.source;

  static const _methods = [PaymentMethod.upi, PaymentMethod.card, PaymentMethod.cash];
  static const _sources = [
    (TransactionSource.nfc, Icons.contactless_outlined),
    (TransactionSource.gmail, Icons.mail_outline_rounded),
    (TransactionSource.sms, Icons.sms_outlined),
    (TransactionSource.manual, Icons.edit_outlined),
  ];

  Widget _group(String title, List<Widget> chips) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title.toUpperCase(), style: TextStyles.micro.copyWith(color: c.inkFaint)),
          const SizedBox(height: Space.xs),
          Wrap(spacing: Space.xs, runSpacing: Space.xs, children: chips),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final cats = ref.watch(categoriesProvider).value ?? const [];
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.85),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.xl, 0, Space.md, Space.sm),
            child: Row(
              children: [
                Expanded(
                  child: Text('Filters', style: TextStyles.title.copyWith(color: c.ink)),
                ),
                TextButton(
                  onPressed: () => setState(() {
                    _amount = AmountRange.any;
                    _category = null;
                    _method = null;
                    _source = null;
                  }),
                  child: Text('Reset', style: TextStyles.heading.copyWith(color: c.accent)),
                ),
              ],
            ),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: Space.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _group('Amount', [
                    for (final a in AmountRange.values) TallyChip(label: a.label, selected: _amount == a, onTap: () => setState(() => _amount = a)),
                  ]),
                  _group('Paid with', [
                    for (final m in _methods) TallyChip(label: m.label, selected: _method == m, onTap: () => setState(() => _method = _method == m ? null : m)),
                  ]),
                  _group('Source', [
                    for (final (s, icon) in _sources)
                      TallyChip(label: s.label, icon: icon, selected: _source == s, onTap: () => setState(() => _source = _source == s ? null : s)),
                  ]),
                  _group('Category', [
                    for (final cat in cats)
                      TallyChip(
                        label: cat.name,
                        icon: categoryIcon(cat.slug),
                        color: catColor(context, cat),
                        selected: _category == cat.id,
                        onTap: () => setState(() => _category = _category == cat.id ? null : cat.id),
                      ),
                  ]),
                ],
              ),
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: c.border)),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Space.xl, Space.sm, Space.xl, Space.md),
              child: AppButton(
                label: 'Show results',
                onPressed: () => Navigator.pop(context, HistoryFilters(amount: _amount, categoryId: _category, method: _method, source: _source)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
