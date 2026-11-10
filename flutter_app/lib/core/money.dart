/// Money helpers. Amounts are always integer paise (1 INR = 100 paise), exactly
/// as on the wire; rupees exist only at the edges (display and text input).
library;

int rupeesToPaise(double rupees) {
  if (!rupees.isFinite) throw RangeError('Cannot convert non-finite value to paise: $rupees');
  // Round, never truncate: 19.99 * 100 == 1998.9999999999998 in IEEE-754.
  return (rupees * 100).round();
}

/// Parses user input such as "1,250.50" or "₹ 499". Returns null when empty/invalid.
int? parseRupeeInput(String input) {
  final cleaned = input.replaceAll(RegExp(r'[^0-9.]'), '');
  if (cleaned.isEmpty) return null;
  final v = double.tryParse(cleaned);
  if (v == null || v <= 0) return null;
  return rupeesToPaise(v);
}

/// Indian lakh/crore grouping: 12345678 → "1,23,45,678".
String _groupIndian(String digits) {
  if (digits.length <= 3) return digits;
  final last3 = digits.substring(digits.length - 3);
  var rest = digits.substring(0, digits.length - 3);
  final parts = <String>[];
  while (rest.length > 2) {
    parts.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) parts.insert(0, rest);
  return '${parts.join(',')},$last3';
}

/// Formats paise as rupees, e.g. 12345678 → "₹1,23,456.78".
String formatPaise(int paise, {bool decimals = true, bool compact = false}) {
  final negative = paise < 0;
  final abs = paise.abs();
  final sign = negative ? '−' : '';
  if (compact) {
    final rupees = abs / 100;
    if (rupees >= 10000000) return '$sign₹${(rupees / 10000000).toStringAsFixed(2)}Cr';
    if (rupees >= 100000) return '$sign₹${(rupees / 100000).toStringAsFixed(2)}L';
    if (rupees >= 1000) return '$sign₹${(rupees / 1000).toStringAsFixed(1)}K';
  }
  if (decimals) {
    final whole = abs ~/ 100;
    final frac = (abs % 100).toString().padLeft(2, '0');
    return '$sign₹${_groupIndian(whole.toString())}.$frac';
  }
  final whole = (abs / 100).round();
  return '$sign₹${_groupIndian(whole.toString())}';
}
