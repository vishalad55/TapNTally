import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;
import 'package:http/http.dart' as http;

import 'api.dart';
import 'models.dart';
import 'token_store.dart';

/// Production API base URL. Override at build time:
///   flutter run --dart-define=API_URL=http://10.0.2.2:3000/api/v1
const String kDefaultApiUrl = String.fromEnvironment('API_URL', defaultValue: 'https://tap-n-tally-backend.vercel.app/api/v1');

/// Thin HTTP client: bearer auth, one automatic refresh-and-retry on 401
/// (single-flight, so parallel requests share one refresh), typed errors.
class HttpTallyApi implements TallyApi {
  HttpTallyApi({required this.baseUrl, required this.tokens, http.Client? client}) : _client = client ?? http.Client();

  final String baseUrl;
  final TokenStore tokens;
  final http.Client _client;
  Future<AuthTokens?>? _refreshing;

  static const _timeout = Duration(seconds: 20);

  @override
  String get endpointLabel => baseUrl;

  Future<AuthTokens?> _refresh() {
    return _refreshing ??= () async {
      try {
        final current = await tokens.read();
        if (current == null) return null;
        final res = await _client
            .post(Uri.parse('$baseUrl/auth/refresh'),
                headers: {'Content-Type': 'application/json'}, body: jsonEncode({'refreshToken': current.refreshToken}))
            .timeout(_timeout);
        if (res.statusCode >= 400) {
          await tokens.clear();
          return null;
        }
        final next = AuthTokens.fromJson(jsonDecode(res.body) as Json);
        await tokens.write(next);
        return next;
      } catch (_) {
        return null;
      } finally {
        _refreshing = null;
      }
    }();
  }

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, String>? query, bool auth = true}) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: (query == null || query.isEmpty) ? null : query);

    Future<http.Response> attempt() async {
      final t = auth ? await tokens.read() : null;
      final req = http.Request(method, uri)
        ..headers.addAll({
          'Accept': 'application/json',
          if (body != null) 'Content-Type': 'application/json',
          if (t != null) 'Authorization': 'Bearer ${t.accessToken}',
        });
      if (body != null) req.body = jsonEncode(body);
      return http.Response.fromStream(await _client.send(req).timeout(_timeout));
    }

    http.Response res;
    try {
      res = await attempt();
      if (res.statusCode == 401 && auth) {
        final refreshed = await _refresh();
        if (refreshed != null) res = await attempt();
      }
    } on ApiException {
      rethrow;
    } catch (e) {
      if (kDebugMode) debugPrint('API $method $path failed: $e');
      throw const ApiException(0, 'NETWORK', "Can't reach TapNTally right now. Check your connection.");
    }

    if (res.statusCode == 204 || res.body.isEmpty) return null;
    final decoded = _tryDecode(res.body);
    if (res.statusCode >= 400) {
      final e = decoded is Map ? decoded : const {};
      throw ApiException(
        res.statusCode,
        (e['code'] as String?) ?? 'HTTP_${res.statusCode}',
        (e['message'] is String ? e['message'] as String : null) ?? 'Request failed (${res.statusCode}).',
        e['details'],
      );
    }
    return decoded;
  }

  static Object? _tryDecode(String body) {
    try {
      return jsonDecode(body);
    } catch (_) {
      return null;
    }
  }

  Future<Json> _json(String method, String path, {Object? body, Map<String, String>? query, bool auth = true}) async =>
      (await _send(method, path, body: body, query: query, auth: auth)) as Json;

  Future<List<Json>> _list(String path, {Map<String, String>? query}) async =>
      ((await _send('GET', path, query: query)) as List? ?? const []).cast<Json>();

  // ---------------------------------------------------------------- auth

  @override
  Future<(User, AuthTokens)> signInDev(String email) async {
    final j = await _json('POST', '/auth/dev', body: {'email': email}, auth: false);
    final t = AuthTokens.fromJson(j['tokens'] as Json);
    await tokens.write(t);
    return (User.fromJson(j['user'] as Json), t);
  }

  @override
  Future<User> me() async => User.fromJson(await _json('GET', '/users/me'));

  @override
  Future<void> logout(String refreshToken) async => _send('POST', '/auth/logout', body: {'refreshToken': refreshToken});

  @override
  Future<User> updateMe({String? name, bool? aggregateInsightsConsent, bool? onboardingCompleted}) async => User.fromJson(await _json(
        'PATCH',
        '/users/me',
        body: {
          'name': ?name,
          'aggregateInsightsConsent': ?aggregateInsightsConsent,
          'onboardingCompleted': ?onboardingCompleted,
        },
      ));

  // --------------------------------------------------------------- reads

  @override
  Future<List<TxCategory>> categories() async => (await _list('/categories')).map(TxCategory.fromJson).toList();

  @override
  Future<Page<Transaction>> transactions(TransactionQuery query, {String? cursor}) async {
    final j = await _json('GET', '/transactions', query: query.toQuery(cursor: cursor));
    return Page(
      items: ((j['items'] as List?) ?? const []).map((e) => Transaction.fromJson(e as Json)).toList(),
      nextCursor: j['nextCursor'] as String?,
      total: (j['total'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  Future<Transaction> transaction(String id) async => Transaction.fromJson(await _json('GET', '/transactions/$id'));

  @override
  Future<SpendSummary> summary({String period = 'month', int offset = 0, String scope = 'personal'}) async =>
      SpendSummary.fromJson(await _json('GET', '/transactions/summary', query: {'period': period, 'offset': '$offset', 'scope': scope}));

  @override
  Future<List<BudgetProgress>> budgets() async => (await _list('/budgets')).map(BudgetProgress.fromJson).toList();

  @override
  Future<Recap> recap({String period = 'monthly', String scope = 'personal'}) async =>
      Recap.fromJson(await _json('GET', '/insights/recap', query: {'period': period, 'scope': scope}));

  @override
  Future<List<Connection>> connections() async => (await _list('/connections')).map(Connection.fromJson).toList();

  @override
  Future<Household?> household() async {
    final j = await _send('GET', '/households/me');
    return j is Json ? Household.fromJson(j) : null;
  }

  // -------------------------------------------------------------- writes

  @override
  Future<Transaction> createTransaction({
    required String merchant,
    required int amountPaise,
    String? categoryId,
    PaymentMethod? paymentMethod,
    bool isShared = false,
  }) async =>
      Transaction.fromJson(await _json('POST', '/transactions', body: {
        'merchant': merchant,
        'amountPaise': amountPaise,
        'categoryId': ?categoryId,
        'paymentMethod': ?paymentMethod?.wire,
        'isShared': isShared,
      }));

  @override
  Future<Transaction> updateTransaction(
    String id, {
    String? categoryId,
    bool? isShared,
    List<String>? tags,
    String? notes,
    bool clearNotes = false,
    PaymentMethod? paymentMethod,
  }) async =>
      Transaction.fromJson(await _json('PATCH', '/transactions/$id', body: {
        'categoryId': ?categoryId,
        'isShared': ?isShared,
        'tags': ?tags,
        if (clearNotes) 'notes': null else 'notes': ?notes,
        'paymentMethod': ?paymentMethod?.wire,
      }));

  @override
  Future<void> deleteTransaction(String id) async => _send('DELETE', '/transactions/$id');

  @override
  Future<Json> demoBill() => _json('GET', '/nfc/demo-bill');

  @override
  Future<NfcIngestResult> ingestNfcBill(Json bill, String idempotencyKey) async =>
      NfcIngestResult.fromJson(await _json('POST', '/nfc/bills', body: {'bill': bill, 'idempotencyKey': idempotencyKey}));

  @override
  Future<BudgetProgress> upsertBudget({required BudgetScope scope, required String categoryId, required int limitPaise, required BudgetPeriod period}) async =>
      BudgetProgress.fromJson(await _json('PUT', '/budgets', body: {
        'scope': scope.name,
        'categoryId': categoryId,
        'limitPaise': limitPaise,
        'period': period.name,
      }));

  @override
  Future<void> deleteBudget(String id) async => _send('DELETE', '/budgets/$id');

  @override
  Future<PairingCode> pairingCode() async => PairingCode.fromJson(await _json('POST', '/pos/pairing-code'));

  @override
  Future<Household> createHousehold(String name) async => Household.fromJson(await _json('POST', '/households', body: {'name': name}));

  @override
  Future<Household> joinHousehold(String code) async =>
      Household.fromJson(await _json('POST', '/households/join', body: {'inviteCode': code}));

  @override
  Future<void> leaveHousehold() async => _send('POST', '/households/leave');

  @override
  Future<Household> rotateInvite() async => Household.fromJson(await _json('POST', '/households/invite/rotate'));

  @override
  Future<Connection> syncGmail() async => Connection.fromJson(await _json('POST', '/connections/gmail/sync'));

  @override
  Future<void> disconnectGmail() async => _send('DELETE', '/connections/gmail');

  @override
  Future<Connection> enableSms() async => Connection.fromJson(await _json('POST', '/connections/sms'));

  @override
  Future<void> disableSms() async => _send('DELETE', '/connections/sms');
}
