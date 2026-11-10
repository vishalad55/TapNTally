import 'dart:math';

import '../core/money.dart';
import 'api.dart';
import 'models.dart';

/// In-memory backend with a seeded household and ~two months of purchases.
///
/// Used by widget tests (deterministic: pass a fixed [now] and [seed]) and by
/// the "Explore offline" option on the sign-in screen, so the app can be shown
/// without a server. Behaviour mirrors the NestJS services closely enough for
/// every screen to exercise its real states.
class DemoTallyApi implements TallyApi {
  DemoTallyApi({DateTime? now, int seed = 7, this.latency = const Duration(milliseconds: 250)})
      : _fixedNow = now,
        _rand = Random(seed) {
    _seed();
  }

  final DateTime? _fixedNow;
  final Random _rand;
  final Duration latency;

  DateTime get now => _fixedNow ?? DateTime.now();

  static const _meId = 'u-demo';
  static const _priyaId = 'u-priya';

  late User _me;
  final List<TxCategory> _cats = [];
  final List<Transaction> _txs = [];
  final List<Budget> _budgets = [];
  Household? _household;
  final Map<ConnectionType, Connection> _conns = {};
  int _seq = 0;

  @override
  String get endpointLabel => 'Offline demo (data stays on this device)';

  Future<T> _delay<T>(T Function() fn) async {
    if (latency > Duration.zero) await Future<void>.delayed(latency);
    return fn();
  }

  String _id(String p) => '$p-${++_seq}';

  // -------------------------------------------------------------- seeding

  static const _catalog = [
    ('groceries', 'Groceries'),
    ('restaurants', 'Eating Out'),
    ('shopping', 'Shopping'),
    ('electronics', 'Electronics'),
    ('transport', 'Transport'),
    ('fuel', 'Fuel'),
    ('bills_utilities', 'Bills & Utilities'),
    ('health', 'Health'),
    ('entertainment', 'Entertainment'),
    ('education', 'Education'),
    ('travel', 'Travel'),
    ('personal_care', 'Personal Care'),
    ('home', 'Home'),
    ('gifts_donations', 'Gifts & Donations'),
    ('fees_charges', 'Fees & Charges'),
    ('uncategorized', 'Uncategorised'),
  ];

  TxCategory _cat(String slug) => _cats.firstWhere((c) => c.slug == slug);

  void _seed() {
    for (final (slug, name) in _catalog) {
      _cats.add(TxCategory(id: 'c-$slug', slug: slug, name: name, color: '#A39C8D'));
    }
    _household = Household(id: 'h-1', name: 'The Sharmas', inviteCode: 'TAP-7QK2M', members: [
      const HouseholdMember(userId: _meId, name: 'Arjun Sharma', role: 'owner'),
      const HouseholdMember(userId: _priyaId, name: 'Priya Sharma', role: 'member'),
    ]);
    _me = const User(
      id: _meId,
      email: 'demo@tapntally.app',
      name: 'Arjun Sharma',
      householdId: 'h-1',
      householdRole: 'owner',
      onboardingCompleted: true,
    );

    const merchants = [
      ('Reliance Fresh', 'groceries', 45000, 180000, TransactionSource.nfc),
      ('BigBasket', 'groceries', 60000, 250000, TransactionSource.gmail),
      ('Swiggy', 'restaurants', 25000, 90000, TransactionSource.gmail),
      ('Third Wave Coffee', 'restaurants', 30000, 70000, TransactionSource.nfc),
      ('Amazon', 'shopping', 50000, 400000, TransactionSource.gmail),
      ('Myntra', 'shopping', 90000, 300000, TransactionSource.gmail),
      ('Uber', 'transport', 15000, 60000, TransactionSource.sms),
      ('Indian Oil', 'fuel', 150000, 300000, TransactionSource.sms),
      ('BESCOM', 'bills_utilities', 120000, 260000, TransactionSource.sms),
      ('Apollo Pharmacy', 'health', 20000, 120000, TransactionSource.nfc),
      ('PVR Cinemas', 'entertainment', 40000, 120000, TransactionSource.manual),
      ('Croma', 'electronics', 200000, 900000, TransactionSource.nfc),
      ('Lakmé Salon', 'personal_care', 60000, 180000, TransactionSource.manual),
    ];
    final methods = [PaymentMethod.upi, PaymentMethod.card, PaymentMethod.cash];
    for (var day = 0; day < 58; day++) {
      final perDay = _rand.nextInt(3);
      for (var k = 0; k < perDay; k++) {
        final (name, slug, lo, hi, source) = merchants[_rand.nextInt(merchants.length)];
        final amount = ((lo + _rand.nextInt(hi - lo)) ~/ 100) * 100;
        final when = DateTime(now.year, now.month, now.day, 9 + _rand.nextInt(12), _rand.nextInt(60)).subtract(Duration(days: day));
        if (when.isAfter(now)) continue;
        final shared = slug == 'groceries' || slug == 'bills_utilities' ? _rand.nextBool() : false;
        final owner = shared && _rand.nextInt(3) == 0 ? _priyaId : _meId;
        _txs.add(_makeTx(
          merchant: name,
          amountPaise: amount,
          category: _cat(slug),
          source: source,
          method: methods[_rand.nextInt(methods.length)],
          occurredAt: when,
          isShared: shared,
          userId: owner,
          confidence: source == TransactionSource.nfc ? CategoryConfidence.high : (_rand.nextInt(4) == 0 ? CategoryConfidence.low : CategoryConfidence.high),
          items: source == TransactionSource.nfc ? _itemsFor(amount) : const [],
        ));
      }
    }
    _txs.sort((a, b) => b.occurredAt.compareTo(a.occurredAt));

    _budgets.addAll([
      Budget(id: _id('b'), scope: BudgetScope.user, categoryId: 'c-restaurants', category: _cat('restaurants'), limitPaise: 400000, period: BudgetPeriod.monthly, alertThreshold: 0.8),
      Budget(id: _id('b'), scope: BudgetScope.user, categoryId: 'c-shopping', category: _cat('shopping'), limitPaise: 800000, period: BudgetPeriod.monthly, alertThreshold: 0.8),
      Budget(id: _id('b'), scope: BudgetScope.user, categoryId: 'c-transport', category: _cat('transport'), limitPaise: 150000, period: BudgetPeriod.weekly, alertThreshold: 0.8),
      Budget(id: _id('b'), scope: BudgetScope.household, categoryId: 'c-groceries', category: _cat('groceries'), limitPaise: 1200000, period: BudgetPeriod.monthly, alertThreshold: 0.8),
    ]);

    _conns[ConnectionType.gmail] = Connection(type: ConnectionType.gmail, status: ConnectionStatus.active, lastSyncedAt: now.subtract(const Duration(minutes: 42)), importedCount: 18);
    _conns[ConnectionType.sms] = const Connection(type: ConnectionType.sms, status: ConnectionStatus.disconnected);
  }

  List<TransactionItem> _itemsFor(int total) {
    final a = total ~/ 3;
    final b = total ~/ 4;
    final c = total - a - b;
    return [
      TransactionItem(name: 'Item A', qty: 1, unitPaise: a, totalPaise: a),
      TransactionItem(name: 'Item B', qty: 2, unitPaise: b ~/ 2, totalPaise: b),
      TransactionItem(name: 'Item C', qty: 1, unitPaise: c, totalPaise: c),
    ];
  }

  Transaction _makeTx({
    required String merchant,
    required int amountPaise,
    required TxCategory category,
    required TransactionSource source,
    required PaymentMethod method,
    required DateTime occurredAt,
    bool isShared = false,
    String userId = _meId,
    CategoryConfidence confidence = CategoryConfidence.high,
    List<TransactionItem> items = const [],
    List<String> tags = const [],
    String? notes,
    bool confirmed = false,
    String? id,
  }) =>
      Transaction(
        id: id ?? _id('t'),
        userId: userId,
        source: source,
        merchant: merchant,
        amountPaise: amountPaise,
        categoryId: category.id,
        category: category,
        categoryConfidence: confidence,
        categoryConfirmed: confirmed,
        paymentMethod: method,
        items: items,
        isShared: isShared,
        tags: tags,
        notes: notes,
        occurredAt: occurredAt,
      );

  // --------------------------------------------------------------- helpers

  (DateTime, DateTime) _range(String period, int offset) {
    if (period == 'week') {
      final monday = DateTime(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
      final start = monday.add(Duration(days: 7 * offset));
      return (start, start.add(const Duration(days: 7)));
    }
    final start = DateTime(now.year, now.month + offset);
    return (start, DateTime(start.year, start.month + 1));
  }

  Iterable<Transaction> _visible(String scope) => switch (scope) {
        'shared' => _txs.where((t) => t.isShared),
        'personal' => _txs.where((t) => t.userId == _meId),
        _ => _txs.where((t) => t.userId == _meId || t.isShared),
      };

  SpendSummary _summarize(Iterable<Transaction> txs) {
    final total = txs.fold<int>(0, (s, t) => s + t.amountPaise);
    final by = <String, (TxCategory, int, int)>{};
    for (final t in txs) {
      final cur = by[t.categoryId];
      by[t.categoryId] = (t.category, (cur?.$2 ?? 0) + t.amountPaise, (cur?.$3 ?? 0) + 1);
    }
    final list = by.values
        .map((v) => CategorySpend(category: v.$1, amountPaise: v.$2, transactionCount: v.$3, share: total == 0 ? 0 : v.$2 / total))
        .toList()
      ..sort((a, b) => b.amountPaise.compareTo(a.amountPaise));
    return SpendSummary(totalPaise: total, byCategory: list);
  }

  // ------------------------------------------------------------------ auth

  @override
  Future<(User, AuthTokens)> signInDev(String email) => _delay(() {
        if (email.trim().toLowerCase().startsWith('priya')) {
          _me = User(id: _meId, email: email, name: 'Priya Sharma', householdId: 'h-1', householdRole: 'member', onboardingCompleted: true);
        }
        return (_me, const AuthTokens(accessToken: 'demo', refreshToken: 'demo', expiresInSeconds: 3600));
      });

  @override
  Future<User> me() => _delay(() => _me);

  @override
  Future<void> logout(String refreshToken) => _delay(() {});

  @override
  Future<User> updateMe({String? name, bool? aggregateInsightsConsent, bool? onboardingCompleted}) => _delay(() {
        _me = User(
          id: _me.id,
          email: _me.email,
          name: name ?? _me.name,
          householdId: _me.householdId,
          householdRole: _me.householdRole,
          aggregateInsightsConsent: aggregateInsightsConsent ?? _me.aggregateInsightsConsent,
          onboardingCompleted: onboardingCompleted ?? _me.onboardingCompleted,
        );
        return _me;
      });

  // ----------------------------------------------------------------- reads

  @override
  Future<List<TxCategory>> categories() => _delay(() => List.of(_cats));

  @override
  Future<Page<Transaction>> transactions(TransactionQuery q, {String? cursor}) => _delay(() {
        final needle = q.q?.toLowerCase();
        final all = _visible(q.scope ?? 'all').where((t) {
          if (needle != null && needle.isNotEmpty && !t.merchant.toLowerCase().contains(needle)) return false;
          if (q.categoryIds != null && q.categoryIds!.isNotEmpty && !q.categoryIds!.contains(t.categoryId)) return false;
          if (q.sources != null && q.sources!.isNotEmpty && !q.sources!.contains(t.source)) return false;
          if (q.paymentMethods != null && q.paymentMethods!.isNotEmpty && !q.paymentMethods!.contains(t.paymentMethod)) return false;
          if (q.minPaise != null && t.amountPaise < q.minPaise!) return false;
          if (q.maxPaise != null && t.amountPaise > q.maxPaise!) return false;
          if (q.from != null && t.occurredAt.isBefore(q.from!)) return false;
          if (q.to != null && !t.occurredAt.isBefore(q.to!)) return false;
          return true;
        }).toList();
        final start = cursor == null ? 0 : int.parse(cursor);
        final end = min(start + q.limit, all.length);
        return Page(items: all.sublist(start, end), nextCursor: end < all.length ? '$end' : null, total: all.length);
      });

  @override
  Future<Transaction> transaction(String id) => _delay(() => _txs.firstWhere((t) => t.id == id,
      orElse: () => throw const ApiException(404, 'NOT_FOUND', 'That purchase no longer exists.')));

  @override
  Future<SpendSummary> summary({String period = 'month', int offset = 0, String scope = 'personal'}) => _delay(() {
        final (from, to) = _range(period, offset);
        return _summarize(_visible(scope).where((t) => !t.occurredAt.isBefore(from) && t.occurredAt.isBefore(to)));
      });

  @override
  Future<List<BudgetProgress>> budgets() => _delay(() => _budgets.map((b) {
        final (from, to) = _range(b.period == BudgetPeriod.weekly ? 'week' : 'month', 0);
        final spent = _visible(b.scope == BudgetScope.household ? 'shared' : 'personal')
            .where((t) => t.categoryId == b.categoryId && !t.occurredAt.isBefore(from) && t.occurredAt.isBefore(to))
            .fold<int>(0, (s, t) => s + t.amountPaise);
        final ratio = b.limitPaise == 0 ? 0.0 : spent / b.limitPaise;
        return BudgetProgress(
          budget: b,
          spentPaise: spent,
          ratio: ratio,
          status: ratio >= 1 ? BudgetStatus.exceeded : (ratio >= b.alertThreshold ? BudgetStatus.warning : BudgetStatus.ok),
        );
      }).toList());

  @override
  Future<Recap> recap({String period = 'monthly', String scope = 'personal'}) => _delay(() {
        final p = period == 'weekly' ? 'week' : 'month';
        final label = period == 'weekly' ? 'week' : 'month';
        final (f0, t0) = _range(p, 0);
        final (f1, t1) = _range(p, -1);
        final cur = _visible(scope).where((t) => !t.occurredAt.isBefore(f0) && t.occurredAt.isBefore(t0)).toList();
        final prev = _visible(scope).where((t) => !t.occurredAt.isBefore(f1) && t.occurredAt.isBefore(t1)).toList();
        final total = cur.fold<int>(0, (s, t) => s + t.amountPaise);
        final prevTotal = prev.fold<int>(0, (s, t) => s + t.amountPaise);
        final change = prevTotal == 0 ? null : (total - prevTotal) / prevTotal;
        final headline = change == null
            ? 'Your first $label on TapNTally: ${formatPaise(total, decimals: false)} so far.'
            : change < 0
                ? 'You spent ${(change.abs() * 100).round()}% less than last $label. Chef’s kiss.'
                : 'Spending is up ${(change * 100).round()}% on last $label.';
        final counts = <String, int>{};
        for (final t in cur) {
          counts[t.merchant] = (counts[t.merchant] ?? 0) + 1;
        }
        final top = counts.entries.isEmpty ? null : counts.entries.reduce((a, b) => a.value >= b.value ? a : b);
        final priciest = cur.isEmpty ? null : cur.reduce((a, b) => a.amountPaise >= b.amountPaise ? a : b);
        return Recap(
          totalPaise: total,
          previousTotalPaise: prevTotal,
          changeRatio: change,
          headline: headline,
          highlights: [
            if (top != null && top.value > 1) '${top.key} saw you ${top.value} times this $label.',
            if (priciest != null) 'Your biggest single purchase was ${formatPaise(priciest.amountPaise, decimals: false)} at ${priciest.merchant}.',
            '${cur.length} purchases tracked, ${cur.where((t) => t.source == TransactionSource.nfc).length} of them by tapping.',
          ],
          priciestPurchase: priciest,
        );
      });

  @override
  Future<List<Connection>> connections() => _delay(() => _conns.values.toList());

  @override
  Future<Household?> household() => _delay(() => _me.householdId == null ? null : _household);

  // ---------------------------------------------------------------- writes

  @override
  Future<Transaction> createTransaction({
    required String merchant,
    required int amountPaise,
    String? categoryId,
    PaymentMethod? paymentMethod,
    bool isShared = false,
  }) =>
      _delay(() {
        final cat = categoryId == null ? _cat('uncategorized') : _cats.firstWhere((c) => c.id == categoryId);
        final tx = _makeTx(
          merchant: merchant,
          amountPaise: amountPaise,
          category: cat,
          source: TransactionSource.manual,
          method: paymentMethod ?? PaymentMethod.unknown,
          occurredAt: now,
          isShared: isShared,
          confirmed: categoryId != null,
          confidence: categoryId == null ? CategoryConfidence.low : CategoryConfidence.high,
        );
        _txs.insert(0, tx);
        return tx;
      });

  @override
  Future<Transaction> updateTransaction(
    String id, {
    String? categoryId,
    bool? isShared,
    List<String>? tags,
    String? notes,
    bool clearNotes = false,
    PaymentMethod? paymentMethod,
  }) =>
      _delay(() {
        final i = _txs.indexWhere((t) => t.id == id);
        final t = _txs[i];
        final cat = categoryId == null ? t.category : _cats.firstWhere((c) => c.id == categoryId);
        final next = _makeTx(
          id: t.id,
          merchant: t.merchant,
          amountPaise: t.amountPaise,
          category: cat,
          source: t.source,
          method: paymentMethod ?? t.paymentMethod,
          occurredAt: t.occurredAt,
          isShared: isShared ?? t.isShared,
          userId: t.userId,
          confidence: t.categoryConfidence,
          confirmed: categoryId != null || t.categoryConfirmed,
          items: t.items,
          tags: tags ?? t.tags,
          notes: clearNotes ? null : (notes ?? t.notes),
        );
        _txs[i] = next;
        return next;
      });

  @override
  Future<void> deleteTransaction(String id) => _delay(() => _txs.removeWhere((t) => t.id == id));

  @override
  Future<Json> demoBill() => _delay(() {
        const items = [
          {'name': 'Amul Taaza Milk 1L', 'qty': 2, 'unitPaise': 6800, 'totalPaise': 13600},
          {'name': 'Aashirvaad Atta 5kg', 'qty': 1, 'unitPaise': 28500, 'totalPaise': 28500},
          {'name': 'Tomatoes (kg)', 'qty': 1.5, 'unitPaise': 4200, 'totalPaise': 6300},
        ];
        const subtotal = 48400;
        const tax = 2420;
        return {
          'v': 1,
          'billId': 'DEMO-${now.millisecondsSinceEpoch}',
          'issuedAt': now.toUtc().toIso8601String(),
          'currency': 'INR',
          'merchant': {'name': 'Reliance Fresh - Koramangala'},
          'terminal': {'network': 'demo', 'terminalId': 'DEMO-01'},
          'items': items,
          'subtotalPaise': subtotal,
          'taxPaise': tax,
          'discountPaise': 0,
          'totalPaise': subtotal + tax,
          'paymentMethod': 'card',
          'sig': 'demo',
        };
      });

  @override
  Future<NfcIngestResult> ingestNfcBill(Json bill, String idempotencyKey) => _delay(() {
        final items = (bill['items'] as List).map((e) => TransactionItem.fromJson(e as Json)).toList();
        final tx = _makeTx(
          merchant: (bill['merchant'] as Json)['name'] as String,
          amountPaise: bill['totalPaise'] as int,
          category: _cat('groceries'),
          source: TransactionSource.nfc,
          method: PaymentMethod.parse(bill['paymentMethod'] as String?),
          occurredAt: now,
          items: items,
        );
        _txs.insert(0, tx);
        return NfcIngestResult(transaction: tx, created: true, signatureVerified: bill['sig'] != null);
      });

  @override
  Future<BudgetProgress> upsertBudget({required BudgetScope scope, required String categoryId, required int limitPaise, required BudgetPeriod period}) =>
      _delay(() {
        _budgets.removeWhere((b) => b.scope == scope && b.categoryId == categoryId);
        final b = Budget(
          id: _id('b'),
          scope: scope,
          categoryId: categoryId,
          category: _cats.firstWhere((c) => c.id == categoryId),
          limitPaise: limitPaise,
          period: period,
          alertThreshold: 0.8,
        );
        _budgets.add(b);
        return BudgetProgress(budget: b, spentPaise: 0, ratio: 0, status: BudgetStatus.ok);
      });

  @override
  Future<void> deleteBudget(String id) => _delay(() => _budgets.removeWhere((b) => b.id == id));

  @override
  Future<PairingCode> pairingCode() => _delay(() {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        final code = List.generate(6, (_) => alphabet[_rand.nextInt(alphabet.length)]).join();
        return PairingCode(code: code, expiresAt: DateTime.now().add(const Duration(minutes: 5)));
      });

  User _withHousehold(String? id, String? role) => User(
        id: _me.id,
        email: _me.email,
        name: _me.name,
        householdId: id,
        householdRole: role,
        aggregateInsightsConsent: _me.aggregateInsightsConsent,
        onboardingCompleted: _me.onboardingCompleted,
      );

  @override
  Future<Household> createHousehold(String name) => _delay(() {
        _household = Household(id: 'h-2', name: name, inviteCode: 'TAP-N3WHM', members: [HouseholdMember(userId: _me.id, name: _me.name, role: 'owner')]);
        _me = _withHousehold('h-2', 'owner');
        return _household!;
      });

  @override
  Future<Household> joinHousehold(String code) => _delay(() {
        if (_household == null || code.toUpperCase() != _household!.inviteCode) {
          throw const ApiException(404, 'INVITE_NOT_FOUND', 'That invite code doesn’t match any household.');
        }
        _me = _withHousehold(_household!.id, 'member');
        return _household!;
      });

  @override
  Future<void> leaveHousehold() => _delay(() => _me = _withHousehold(null, null));

  @override
  Future<Household> rotateInvite() => _delay(() {
        final h = _household!;
        return _household = Household(id: h.id, name: h.name, inviteCode: 'TAP-${_rand.nextInt(89999) + 10000}', members: h.members);
      });

  @override
  Future<Connection> syncGmail() => _delay(() => _conns[ConnectionType.gmail] = Connection(
        type: ConnectionType.gmail,
        status: ConnectionStatus.active,
        lastSyncedAt: DateTime.now(),
        importedCount: _conns[ConnectionType.gmail]?.importedCount ?? 0,
      ));

  @override
  Future<void> disconnectGmail() =>
      _delay(() => _conns[ConnectionType.gmail] = const Connection(type: ConnectionType.gmail, status: ConnectionStatus.disconnected));

  @override
  Future<Connection> enableSms() => _delay(
      () => _conns[ConnectionType.sms] = Connection(type: ConnectionType.sms, status: ConnectionStatus.active, lastSyncedAt: DateTime.now()));

  @override
  Future<void> disableSms() => _delay(() => _conns[ConnectionType.sms] = const Connection(type: ConnectionType.sms, status: ConnectionStatus.disconnected));
}
