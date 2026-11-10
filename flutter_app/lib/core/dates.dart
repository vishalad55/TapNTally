import 'package:intl/intl.dart';

bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

bool isToday(DateTime d, [DateTime? now]) => _sameDay(d, now ?? DateTime.now());
bool isYesterday(DateTime d, [DateTime? now]) => _sameDay(d, (now ?? DateTime.now()).subtract(const Duration(days: 1)));

/// "Today · 4:05 PM", "Yesterday · 9:10 AM", "3 Nov · 1:00 PM".
String friendlyDate(DateTime d, [DateTime? now]) {
  final local = d.toLocal();
  final time = DateFormat('h:mm a').format(local);
  if (isToday(local, now)) return 'Today · $time';
  if (isYesterday(local, now)) return 'Yesterday · $time';
  return '${DateFormat('d MMM').format(local)} · $time';
}

/// Section header label for a day in the history list.
String dayLabel(DateTime d, [DateTime? now]) {
  final local = d.toLocal();
  if (isToday(local, now)) return 'Today';
  if (isYesterday(local, now)) return 'Yesterday';
  return DateFormat('EEEE, d MMM').format(local);
}

String relativeTime(DateTime d, [DateTime? now]) {
  final diff = (now ?? DateTime.now()).difference(d);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
  if (diff.inHours < 24) return '${diff.inHours} h ago';
  if (diff.inDays < 30) return '${diff.inDays} d ago';
  return DateFormat('d MMM yyyy').format(d.toLocal());
}

String greeting([DateTime? now]) {
  final h = (now ?? DateTime.now()).hour;
  return h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
}

DateTime startOfMonth(DateTime d) => DateTime(d.year, d.month);
