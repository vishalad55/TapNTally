import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../widgets/brand.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const BrandMark(size: 72),
            const SizedBox(height: Space.lg),
            SizedBox.square(dimension: 24, child: CircularProgressIndicator(strokeWidth: 2.4, color: c.accent)),
          ],
        ),
      ),
    );
  }
}
