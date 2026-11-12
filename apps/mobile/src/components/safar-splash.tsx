import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Easing,
  TouchableWithoutFeedback,
} from 'react-native';

export default function SafarSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const dismissingRef = useRef(false);

  // Overlay fade & scale on exit
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const overlayScale = useRef(new Animated.Value(1)).current;

  // Logo entrance (scale 0.65 -> 1.06 -> 1, translateY 18 -> 0, opacity 0 -> 1)
  const logoScale = useRef(new Animated.Value(0.65)).current;
  const logoTranslateY = useRef(new Animated.Value(18)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // Ambient orange glow pulse behind logo
  const glowScale = useRef(new Animated.Value(0.92)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;

  // Brand text & tagline entrance
  const textTranslateY = useRef(new Animated.Value(12)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  // Progress bar fill (0 -> 140px)
  const progressWidth = useRef(new Animated.Value(0)).current;

  const dismissSplash = () => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayScale, {
        toValue: 1.03,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  };

  useEffect(() => {
    // 1. Logo pop-in animation (matches @keyframes safarSplashLogoIn)
    Animated.parallel([
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.06,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(logoTranslateY, {
        toValue: 0,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Pulsing orange glow (matches @keyframes safarGlowPulse)
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1.16,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.85,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 0.94,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.4,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // 3. Brand title & tagline entrance (matches @keyframes safarSplashTextIn)
    Animated.sequence([
      Animated.delay(220),
      Animated.parallel([
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 4. Progress bar fill (matches @keyframes safarProgress)
    Animated.timing(progressWidth, {
      toValue: 140,
      duration: 1150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // 5. Auto-dismiss after entrance completes
    const timer = setTimeout(() => {
      dismissSplash();
    }, 1350);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <TouchableWithoutFeedback onPress={dismissSplash}>
      <Animated.View
        style={[
          s.overlay,
          {
            opacity: overlayOpacity,
            transform: [{ scale: overlayScale }],
          },
        ]}
      >
        <View style={s.card}>
          {/* Animated Logo Circle + Glow */}
          <Animated.View
            style={[
              s.logoWrap,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }, { translateY: logoTranslateY }],
              },
            ]}
          >
            <Animated.View
              style={[
                s.glowRing,
                {
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                },
              ]}
            />
            <Image
              source={require('../../assets/safar-logo.png')}
              style={s.logoImg}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Animated Brand Name, Badge & Tagline */}
          <Animated.View
            style={[
              s.textGroup,
              {
                opacity: textOpacity,
                transform: [{ translateY: textTranslateY }],
              },
            ]}
          >
            <View style={s.brandRow}>
              <Text style={s.brandName}>Safar</Text>
              <View style={s.brandBadge}>
                <Text style={s.brandBadgeText}>SELF DRIVE</Text>
              </View>
            </View>
            <Text style={s.tagline}>Your Journey. Your Rules.</Text>
          </Animated.View>

          {/* Animated Progress Bar */}
          <View style={s.progressBarTrack}>
            <Animated.View style={[s.progressBarFill, { width: progressWidth }]} />
          </View>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 999999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 360,
    width: '100%',
  },
  logoWrap: {
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#FFF7ED',
    marginBottom: 18,
  },
  glowRing: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: 'rgba(255, 96, 0, 0.14)',
  },
  logoImg: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  textGroup: {
    alignItems: 'center',
    marginBottom: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 5,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandBadge: {
    backgroundColor: '#FF6000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    shadowColor: '#FF6000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  brandBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  tagline: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  progressBarTrack: {
    width: 140,
    height: 3.5,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF6000',
    borderRadius: 999,
  },
});
