import 'models.dart';

/// Everything the app needs from the backend (`/api/v1`). Two implementations:
///  * [HttpTallyApi] talks to the NestJS backend.
///  * [DemoTallyApi] is an in-memory backend used by widget tests and by the
///    "Explore offline" option on the sign-in screen.
abstract class TallyApi {
  /// Human-readable description of where data comes from (shown in Settings).
  String get endpointLabel;

  // auth
  Future<(User, AuthTokens)> signInDev(String email);
  Future<User> me();
  Future<void> logout(String refreshToken);
  Future<User> updateMe({String? name, bool? aggregateInsightsConsent, bool? onboardingCompleted});

  // reads
  Future<List<TxCategory>> categories();
  Future<Page<Transaction>> transactions(TransactionQuery query, {String? cursor});
  Future<Transaction> transaction(String id);
  Future<SpendSummary> summary({String period = 'month', int offset = 0, String scope = 'personal'});
  Future<List<BudgetProgress>> budgets();
  Future<Recap> recap({String period = 'monthly', String scope = 'personal'});
  Future<List<Connection>> connections();
  Future<Household?> household();

  // writes
  Future<Transaction> createTransaction({
    required String merchant,
    required int amountPaise,
    String? categoryId,
    PaymentMethod? paymentMethod,
    bool isShared = false,
  });
  Future<Transaction> updateTransaction(
    String id, {
    String? categoryId,
    bool? isShared,
    List<String>? tags,
    String? notes,
    bool clearNotes = false,
    PaymentMethod? paymentMethod,
  });
  Future<void> deleteTransaction(String id);

  /// Fetches a signed demo bill from the backend's demo terminal.
  Future<Json> demoBill();
  Future<NfcIngestResult> ingestNfcBill(Json bill, String idempotencyKey);

  Future<BudgetProgress> upsertBudget({required BudgetScope scope, required String categoryId, required int limitPaise, required BudgetPeriod period});
  Future<void> deleteBudget(String id);

  Future<PairingCode> pairingCode();

  Future<Household> createHousehold(String name);
  Future<Household> joinHousehold(String code);
  Future<void> leaveHousehold();
  Future<Household> rotateInvite();

  Future<Connection> syncGmail();
  Future<void> disconnectGmail();
  Future<Connection> enableSms();
  Future<void> disableSms();
}

/// Typed failure from the API. [status] 0 means the network was unreachable.
class ApiException implements Exception {
  const ApiException(this.status, this.code, this.message, [this.details]);
  final int status;
  final String code;
  final String message;
  final Object? details;

  bool get isNetwork => status == 0;

  /// Validation errors the backend attaches under `details.errors`.
  List<String> get detailErrors {
    final d = details;
    if (d is Map && d['errors'] is List) return (d['errors'] as List).map((e) => '$e').toList();
    return const [];
  }

  @override
  String toString() => 'ApiException($status, $code): $message';
}

/// Message suitable for showing to a person, whatever was thrown.
String friendlyError(Object error, [String fallback = 'Something went wrong. Please try again.']) =>
    error is ApiException ? error.message : fallback;
