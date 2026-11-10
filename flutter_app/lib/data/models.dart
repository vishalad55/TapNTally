/// Dart mirrors of the TypeScript contract in `shared/src/types`.
/// Hand-written (no codegen) so the wire shape is obvious to review.
library;

typedef Json = Map<String, dynamic>;

DateTime _date(Object? v) => DateTime.parse(v as String);
DateTime? _dateOrNull(Object? v) => v == null ? null : DateTime.parse(v as String);
int _int(Object? v) => (v as num?)?.round() ?? 0;
double _double(Object? v) => (v as num?)?.toDouble() ?? 0;

enum TransactionSource {
  nfc('nfc', 'Tap'),
  gmail('gmail', 'Gmail'),
  sms('sms', 'SMS'),
  manual('manual', 'Manual'),
  posPartner('pos_partner', 'POS');

  const TransactionSource(this.wire, this.label);
  final String wire;
  final String label;
  static TransactionSource parse(String? v) => values.firstWhere((e) => e.wire == v, orElse: () => manual);
}

enum PaymentMethod {
  upi('upi', 'UPI'),
  card('card', 'Card'),
  cash('cash', 'Cash'),
  netBanking('net_banking', 'Net banking'),
  wallet('wallet', 'Wallet'),
  unknown('unknown', 'Unknown');

  const PaymentMethod(this.wire, this.label);
  final String wire;
  final String label;
  static PaymentMethod parse(String? v) => values.firstWhere((e) => e.wire == v, orElse: () => unknown);
}

enum CategoryConfidence {
  high,
  medium,
  low;

  static CategoryConfidence parse(String? v) => values.firstWhere((e) => e.name == v, orElse: () => low);
}

enum BudgetScope {
  user,
  household;

  static BudgetScope parse(String? v) => v == 'household' ? household : user;
}

enum BudgetPeriod {
  monthly,
  weekly;

  static BudgetPeriod parse(String? v) => v == 'weekly' ? weekly : monthly;
}

enum BudgetStatus {
  ok,
  warning,
  exceeded;

  static BudgetStatus parse(String? v) => values.firstWhere((e) => e.name == v, orElse: () => ok);
}

enum ConnectionType {
  gmail,
  sms;

  static ConnectionType parse(String? v) => v == 'sms' ? sms : gmail;
}

enum ConnectionStatus {
  disconnected('disconnected', 'Not connected'),
  backfilling('backfilling', 'Scanning history'),
  active('active', 'Connected'),
  needsReauth('needs_reauth', 'Needs reconnect'),
  error('error', 'Sync error');

  const ConnectionStatus(this.wire, this.label);
  final String wire;
  final String label;
  static ConnectionStatus parse(String? v) => values.firstWhere((e) => e.wire == v, orElse: () => disconnected);
}

class AuthTokens {
  const AuthTokens({required this.accessToken, required this.refreshToken, required this.expiresInSeconds});
  final String accessToken;
  final String refreshToken;
  final int expiresInSeconds;

  factory AuthTokens.fromJson(Json j) => AuthTokens(
        accessToken: j['accessToken'] as String,
        refreshToken: j['refreshToken'] as String,
        expiresInSeconds: _int(j['expiresInSeconds']),
      );
  Json toJson() => {'accessToken': accessToken, 'refreshToken': refreshToken, 'expiresInSeconds': expiresInSeconds};
}

class User {
  const User({
    required this.id,
    required this.email,
    required this.name,
    this.avatarUrl,
    this.householdId,
    this.householdRole,
    this.aggregateInsightsConsent = false,
    this.onboardingCompleted = false,
  });
  final String id;
  final String email;
  final String name;
  final String? avatarUrl;
  final String? householdId;
  final String? householdRole;
  final bool aggregateInsightsConsent;
  final bool onboardingCompleted;

  String get firstName => name.trim().split(RegExp(r'\s+')).first;
  String get initial => name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
  bool get isHouseholdOwner => householdRole == 'owner';

  factory User.fromJson(Json j) => User(
        id: j['id'] as String,
        email: j['email'] as String? ?? '',
        name: j['name'] as String? ?? '',
        avatarUrl: j['avatarUrl'] as String?,
        householdId: j['householdId'] as String?,
        householdRole: j['householdRole'] as String?,
        aggregateInsightsConsent: j['aggregateInsightsConsent'] as bool? ?? false,
        onboardingCompleted: j['onboardingCompleted'] as bool? ?? false,
      );
}

class TxCategory {
  const TxCategory({required this.id, required this.slug, required this.name, required this.color, this.isCustom = false});
  final String id;
  final String? slug;
  final String name;
  final String color;
  final bool isCustom;

  factory TxCategory.fromJson(Json j) => TxCategory(
        id: j['id'] as String,
        slug: j['slug'] as String?,
        name: j['name'] as String? ?? 'Uncategorised',
        color: j['color'] as String? ?? '#A39C8D',
        isCustom: j['isCustom'] as bool? ?? false,
      );

  @override
  bool operator ==(Object other) => other is TxCategory && other.id == id;
  @override
  int get hashCode => id.hashCode;
}

class TransactionItem {
  const TransactionItem({required this.name, required this.qty, required this.unitPaise, required this.totalPaise});
  final String name;
  final double qty;
  final int unitPaise;
  final int totalPaise;

  String get qtyLabel => qty == qty.roundToDouble() ? qty.toInt().toString() : qty.toStringAsFixed(2);

  factory TransactionItem.fromJson(Json j) => TransactionItem(
        name: j['name'] as String? ?? '',
        qty: _double(j['qty']),
        unitPaise: _int(j['unitPaise']),
        totalPaise: _int(j['totalPaise']),
      );
}

class Transaction {
  const Transaction({
    required this.id,
    required this.userId,
    required this.source,
    required this.merchant,
    required this.amountPaise,
    required this.categoryId,
    required this.category,
    required this.categoryConfidence,
    required this.categoryConfirmed,
    required this.paymentMethod,
    required this.items,
    required this.isShared,
    required this.tags,
    required this.notes,
    required this.occurredAt,
  });

  final String id;
  final String userId;
  final TransactionSource source;
  final String merchant;
  final int amountPaise;
  final String categoryId;
  final TxCategory category;
  final CategoryConfidence categoryConfidence;
  final bool categoryConfirmed;
  final PaymentMethod paymentMethod;
  final List<TransactionItem> items;
  final bool isShared;
  final List<String> tags;
  final String? notes;
  final DateTime occurredAt;

  /// Auto-categorised with less than high confidence and not yet confirmed.
  bool get needsReview => !categoryConfirmed && categoryConfidence != CategoryConfidence.high;

  factory Transaction.fromJson(Json j) => Transaction(
        id: j['id'] as String,
        userId: j['userId'] as String? ?? '',
        source: TransactionSource.parse(j['source'] as String?),
        merchant: j['merchant'] as String? ?? '',
        amountPaise: _int(j['amountPaise']),
        categoryId: j['categoryId'] as String? ?? (j['category'] as Json?)?['id'] as String? ?? '',
        category: TxCategory.fromJson(j['category'] as Json),
        categoryConfidence: CategoryConfidence.parse(j['categoryConfidence'] as String?),
        categoryConfirmed: j['categoryConfirmed'] as bool? ?? false,
        paymentMethod: PaymentMethod.parse(j['paymentMethod'] as String?),
        items: ((j['items'] as List?) ?? const []).map((e) => TransactionItem.fromJson(e as Json)).toList(),
        isShared: j['isShared'] as bool? ?? false,
        tags: ((j['tags'] as List?) ?? const []).cast<String>(),
        notes: j['notes'] as String?,
        occurredAt: _date(j['occurredAt']),
      );
}

class Page<T> {
  const Page({required this.items, required this.nextCursor, required this.total});
  final List<T> items;
  final String? nextCursor;
  final int total;
}

class Budget {
  const Budget({
    required this.id,
    required this.scope,
    required this.categoryId,
    required this.category,
    required this.limitPaise,
    required this.period,
    required this.alertThreshold,
  });
  final String id;
  final BudgetScope scope;
  final String categoryId;
  final TxCategory category;
  final int limitPaise;
  final BudgetPeriod period;
  final double alertThreshold;

  factory Budget.fromJson(Json j) => Budget(
        id: j['id'] as String,
        scope: BudgetScope.parse(j['scope'] as String?),
        categoryId: j['categoryId'] as String? ?? (j['category'] as Json)['id'] as String,
        category: TxCategory.fromJson(j['category'] as Json),
        limitPaise: _int(j['limitPaise']),
        period: BudgetPeriod.parse(j['period'] as String?),
        alertThreshold: j['alertThreshold'] == null ? 0.8 : _double(j['alertThreshold']),
      );
}

class BudgetProgress {
  const BudgetProgress({required this.budget, required this.spentPaise, required this.ratio, required this.status});
  final Budget budget;
  final int spentPaise;
  final double ratio;
  final BudgetStatus status;

  factory BudgetProgress.fromJson(Json j) => BudgetProgress(
        budget: Budget.fromJson(j['budget'] as Json),
        spentPaise: _int(j['spentPaise']),
        ratio: _double(j['ratio']),
        status: BudgetStatus.parse(j['status'] as String?),
      );
}

class HouseholdMember {
  const HouseholdMember({required this.userId, required this.name, required this.role});
  final String userId;
  final String name;
  final String role;
  factory HouseholdMember.fromJson(Json j) =>
      HouseholdMember(userId: j['userId'] as String, name: j['name'] as String? ?? '', role: j['role'] as String? ?? 'member');
}

class Household {
  const Household({required this.id, required this.name, required this.inviteCode, required this.members});
  final String id;
  final String name;
  final String inviteCode;
  final List<HouseholdMember> members;
  factory Household.fromJson(Json j) => Household(
        id: j['id'] as String,
        name: j['name'] as String? ?? '',
        inviteCode: j['inviteCode'] as String? ?? '',
        members: ((j['members'] as List?) ?? const []).map((e) => HouseholdMember.fromJson(e as Json)).toList(),
      );
}

class Connection {
  const Connection({required this.type, required this.status, this.lastSyncedAt, this.importedCount = 0, this.lastError});
  final ConnectionType type;
  final ConnectionStatus status;
  final DateTime? lastSyncedAt;
  final int importedCount;
  final String? lastError;
  factory Connection.fromJson(Json j) => Connection(
        type: ConnectionType.parse(j['type'] as String?),
        status: ConnectionStatus.parse(j['status'] as String?),
        lastSyncedAt: _dateOrNull(j['lastSyncedAt']),
        importedCount: _int(j['importedCount']),
        lastError: j['lastError'] as String?,
      );
}

class CategorySpend {
  const CategorySpend({required this.category, required this.amountPaise, required this.transactionCount, required this.share});
  final TxCategory category;
  final int amountPaise;
  final int transactionCount;
  final double share;
  factory CategorySpend.fromJson(Json j) => CategorySpend(
        category: TxCategory.fromJson(j['category'] as Json),
        amountPaise: _int(j['amountPaise']),
        transactionCount: _int(j['transactionCount']),
        share: _double(j['share']),
      );
}

class SpendSummary {
  const SpendSummary({required this.totalPaise, required this.byCategory});
  final int totalPaise;
  final List<CategorySpend> byCategory;
  int get purchaseCount => byCategory.fold(0, (s, c) => s + c.transactionCount);
  factory SpendSummary.fromJson(Json j) => SpendSummary(
        totalPaise: _int(j['totalPaise']),
        byCategory: ((j['byCategory'] as List?) ?? const []).map((e) => CategorySpend.fromJson(e as Json)).toList(),
      );
}

class Recap {
  const Recap({
    required this.totalPaise,
    required this.previousTotalPaise,
    required this.changeRatio,
    required this.headline,
    required this.highlights,
    this.priciestPurchase,
  });
  final int totalPaise;
  final int previousTotalPaise;
  final double? changeRatio;
  final String headline;
  final List<String> highlights;
  final Transaction? priciestPurchase;
  factory Recap.fromJson(Json j) => Recap(
        totalPaise: _int(j['totalPaise']),
        previousTotalPaise: _int(j['previousTotalPaise']),
        changeRatio: (j['changeRatio'] as num?)?.toDouble(),
        headline: j['headline'] as String? ?? '',
        highlights: ((j['highlights'] as List?) ?? const []).cast<String>(),
        priciestPurchase: j['priciestPurchase'] == null ? null : Transaction.fromJson(j['priciestPurchase'] as Json),
      );
}

class PairingCode {
  const PairingCode({required this.code, required this.expiresAt});
  final String code;
  final DateTime expiresAt;
  factory PairingCode.fromJson(Json j) => PairingCode(code: j['code'] as String, expiresAt: _date(j['expiresAt']));
}

class NfcIngestResult {
  const NfcIngestResult({required this.transaction, required this.created, required this.signatureVerified});
  final Transaction transaction;
  final bool created;
  final bool signatureVerified;
  factory NfcIngestResult.fromJson(Json j) => NfcIngestResult(
        transaction: Transaction.fromJson(j['transaction'] as Json),
        created: j['created'] as bool? ?? true,
        signatureVerified: j['signatureVerified'] as bool? ?? false,
      );
}

/// Filters for GET /transactions (mirrors `TransactionQuery`).
class TransactionQuery {
  const TransactionQuery({
    this.q,
    this.categoryIds,
    this.sources,
    this.paymentMethods,
    this.minPaise,
    this.maxPaise,
    this.from,
    this.to,
    this.scope,
    this.limit = 30,
  });
  final String? q;
  final List<String>? categoryIds;
  final List<TransactionSource>? sources;
  final List<PaymentMethod>? paymentMethods;
  final int? minPaise;
  final int? maxPaise;
  final DateTime? from;
  final DateTime? to;

  /// 'personal' | 'shared' | 'all'
  final String? scope;
  final int limit;

  Map<String, String> toQuery({String? cursor}) => {
        if (q != null && q!.isNotEmpty) 'q': q!,
        if (categoryIds != null && categoryIds!.isNotEmpty) 'categoryIds': categoryIds!.join(','),
        if (sources != null && sources!.isNotEmpty) 'sources': sources!.map((s) => s.wire).join(','),
        if (paymentMethods != null && paymentMethods!.isNotEmpty) 'paymentMethods': paymentMethods!.map((m) => m.wire).join(','),
        'minPaise': ?minPaise?.toString(),
        'maxPaise': ?maxPaise?.toString(),
        if (from != null) 'from': from!.toUtc().toIso8601String(),
        if (to != null) 'to': to!.toUtc().toIso8601String(),
        'scope': ?scope,
        'limit': '$limit',
        'cursor': ?cursor,
      };

  /// Stable key for caching: two equal queries share one provider.
  String get key => toQuery().entries.map((e) => '${e.key}=${e.value}').join('&');

  @override
  bool operator ==(Object other) => other is TransactionQuery && other.key == key;
  @override
  int get hashCode => key.hashCode;
}
