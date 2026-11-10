import 'package:flutter_test/flutter_test.dart';
import 'package:tapntally/core/money.dart';
import 'package:tapntally/data/demo_api.dart';
import 'package:tapntally/data/models.dart';
import 'package:tapntally/data/nfc.dart';

Map<String, dynamic> _bill() => {
      'v': 1,
      'billId': 'B-1',
      'issuedAt': '2026-11-10T10:00:00+05:30',
      'currency': 'INR',
      'merchant': {'name': 'Reliance Fresh'},
      'terminal': {'network': 'paytm', 'terminalId': 'T1'},
      'items': [
        {'name': 'Milk', 'qty': 2, 'unitPaise': 6800, 'totalPaise': 13600},
        {'name': 'Atta', 'qty': 1, 'unitPaise': 28500, 'totalPaise': 28500},
      ],
      'subtotalPaise': 42100,
      'taxPaise': 2105,
      'discountPaise': 100,
      'totalPaise': 44105,
      'paymentMethod': 'card',
    };

void main() {
  group('formatPaise', () {
    test('uses lakh/crore grouping', () {
      expect(formatPaise(12345678), '₹1,23,456.78');
      expect(formatPaise(100), '₹1.00');
      expect(formatPaise(99), '₹0.99');
      expect(formatPaise(123456789012), '₹1,23,45,67,890.12');
    });
    test('whole rupees round half up', () {
      expect(formatPaise(150, decimals: false), '₹2');
      expect(formatPaise(4999900, decimals: false), '₹49,999');
    });
    test('negative and compact', () {
      expect(formatPaise(-25000, decimals: false), '−₹250');
      expect(formatPaise(15000000, compact: true), '₹1.50L');
      expect(formatPaise(250000, compact: true), '₹2.5K');
    });
  });

  group('rupee input', () {
    test('never truncates float error', () => expect(rupeesToPaise(19.99), 1999));
    test('parses formatted input', () {
      expect(parseRupeeInput('1,250.50'), 125050);
      expect(parseRupeeInput('₹ 499'), 49900);
      expect(parseRupeeInput(''), isNull);
      expect(parseRupeeInput('0'), isNull);
    });
  });

  group('validateTbefBill (mirror of shared/src/logic/tbef.ts)', () {
    test('accepts a well-formed bill', () => expect(validateTbefBill(_bill()), isEmpty));
    test('rejects a total that does not reconcile', () {
      final b = _bill()..['totalPaise'] = 1;
      expect(validateTbefBill(b).single, contains('totalPaise'));
    });
    test('rejects missing merchant and bad payment method', () {
      final b = _bill()
        ..remove('merchant')
        ..['paymentMethod'] = 'cheque';
      expect(validateTbefBill(b), containsAll(['merchant.name required', 'paymentMethod invalid']));
    });
    test('rejects non-objects', () => expect(validateTbefBill('nope'), ['bill must be an object']));
  });

  test('TransactionQuery serialises filters the backend understands', () {
    final q = TransactionQuery(
      q: 'swig',
      categoryIds: const ['a', 'b'],
      sources: const [TransactionSource.nfc, TransactionSource.posPartner],
      paymentMethods: const [PaymentMethod.netBanking],
      minPaise: 50000,
      scope: 'shared',
      limit: 40,
    );
    expect(q.toQuery(cursor: 'c1'), {
      'q': 'swig',
      'categoryIds': 'a,b',
      'sources': 'nfc,pos_partner',
      'paymentMethods': 'net_banking',
      'minPaise': '50000',
      'scope': 'shared',
      'limit': '40',
      'cursor': 'c1',
    });
    // Equal filters → equal cache key, so two screens share one feed provider.
    expect(q, TransactionQuery(q: 'swig', categoryIds: const ['a', 'b'], sources: const [TransactionSource.nfc, TransactionSource.posPartner], paymentMethods: const [PaymentMethod.netBanking], minPaise: 50000, scope: 'shared', limit: 40));
    expect(q == const TransactionQuery(q: 'other'), isFalse);
  });

  group('DemoTallyApi', () {
    final api = DemoTallyApi(latency: Duration.zero);
    test('summary shares add up to 1', () async {
      final s = await api.summary();
      if (s.totalPaise > 0) expect(s.byCategory.fold<double>(0, (a, c) => a + c.share), closeTo(1, 1e-9));
    });
    test('pagination covers every row exactly once', () async {
      const q = TransactionQuery(limit: 7, scope: 'all');
      final first = await api.transactions(q);
      final seen = {...first.items.map((t) => t.id)};
      var cursor = first.nextCursor;
      while (cursor != null) {
        final page = await api.transactions(q, cursor: cursor);
        for (final t in page.items) {
          expect(seen.add(t.id), isTrue);
        }
        cursor = page.nextCursor;
      }
      expect(seen.length, first.total);
    });
    test('demo bill passes the TBEF validator', () async => expect(validateTbefBill(await api.demoBill()), isEmpty));
  });
}
