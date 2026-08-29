import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Pressable,
  SafeAreaView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";

const BASE_URL = "https://quiz.nilsson.ink";

type GameMode = "home" | "host" | "join" | "solo" | "quizmaster" | "hall";

const routes: Record<Exclude<GameMode, "home">, { title: string; url: string }> = {
  host: { title: "Starta quizkväll", url: `${BASE_URL}/online.html?action=best` },
  join: { title: "Gå med", url: `${BASE_URL}/online.html?action=join` },
  solo: { title: "Spela själv", url: `${BASE_URL}/online.html?action=solo` },
  quizmaster: { title: "Quizmaster", url: `${BASE_URL}/quizmaster.html` },
  hall: { title: "Hall of Fame", url: `${BASE_URL}/hall-of-fame.html` }
};

export default function App() {
  const [mode, setMode] = useState<GameMode>("home");
  const [loading, setLoading] = useState(false);
  const [webCanGoBack, setWebCanGoBack] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const webRef = useRef<WebView>(null);

  const active = mode === "home" ? null : routes[mode];

  React.useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (mode === "home") return false;
      if (webCanGoBack) {
        webRef.current?.goBack();
      } else {
        setMode("home");
      }
      return true;
    });
    return () => sub.remove();
  }, [mode, webCanGoBack]);

  const openMode = (next: GameMode) => {
    setLoadError(null);
    setMode(next);
  };

  if (mode !== "home" && active) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#07111F" />
        <View style={styles.topbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tillbaka"
            onPress={() => {
              if (webCanGoBack) webRef.current?.goBack();
              else setMode("home");
            }}
            style={styles.iconButton}
          >
            <Ionicons name="chevron-back" size={27} color="#F7FAFC" />
          </Pressable>

          <Text numberOfLines={1} style={styles.topbarTitle}>{active.title}</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dela"
            onPress={() => Share.share({ message: active.url, url: active.url })}
            style={styles.iconButton}
          >
            <Ionicons name="share-outline" size={24} color="#F7FAFC" />
          </Pressable>
        </View>

        {loadError ? (
          <View style={styles.errorWrap}>
            <Ionicons name="cloud-offline-outline" size={58} color="#7DD3FC" />
            <Text style={styles.errorTitle}>Kunde inte ansluta</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable style={styles.primaryButton} onPress={() => {
              setLoadError(null);
              webRef.current?.reload();
            }}>
              <Text style={styles.primaryButtonText}>Försök igen</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setMode("home")}>
              <Text style={styles.secondaryButtonText}>Till startsidan</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.webWrap}>
            <WebView
              ref={webRef}
              source={{ uri: active.url }}
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              setSupportMultipleWindows={false}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onNavigationStateChange={(nav) => setWebCanGoBack(nav.canGoBack)}
              onError={(event) => {
                setLoading(false);
                setLoadError(event.nativeEvent.description || "Kontrollera internetanslutningen.");
              }}
              onHttpError={(event) => {
                if (event.nativeEvent.statusCode >= 500) {
                  setLoadError(`Servern svarade med HTTP ${event.nativeEvent.statusCode}.`);
                }
              }}
              onShouldStartLoadWithRequest={(request) => {
                const url = request.url;
                if (
                  url.startsWith(BASE_URL) ||
                  url.startsWith("about:blank") ||
                  url.startsWith("data:")
                ) return true;

                Linking.openURL(url).catch(() => {
                  Alert.alert("Kunde inte öppna länken", url);
                });
                return false;
              }}
              injectedJavaScript={`
                (function() {
                  var meta = document.querySelector('meta[name="viewport"]');
                  if (!meta) {
                    meta = document.createElement('meta');
                    meta.name = 'viewport';
                    document.head.appendChild(meta);
                  }
                  meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';
                  document.documentElement.style.webkitTextSizeAdjust = '100%';
                  true;
                })();
              `}
            />
            {loading && (
              <View pointerEvents="none" style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#7DD3FC" />
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#07111F" />
      <View style={styles.home}>
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.kicker}>RESEQUIZ</Text>
            <Text style={styles.title}>Quizkvällen{`\n`}börjar här.</Text>
          </View>
          <View style={styles.logoBadge}>
            <Ionicons name="airplane" size={30} color="#07111F" />
          </View>
        </View>

        <Text style={styles.subtitle}>
          Starta ett spel, gå med från mobilen eller kör själv.
        </Text>

        <Pressable style={[styles.actionCard, styles.actionCardPrimary]} onPress={() => openMode("host")}>
          <View style={styles.actionIcon}>
            <Ionicons name="game-controller" size={29} color="#07111F" />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitlePrimary}>Starta quizkväll</Text>
            <Text style={styles.actionSubPrimary}>Skapa rum och kör Auto-Pilot</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#07111F" />
        </Pressable>

        <View style={styles.row}>
          <Pressable style={[styles.smallCard, styles.smallCardStrong]} onPress={() => openMode("join")}>
            <Ionicons name="phone-portrait-outline" size={28} color="#F7FAFC" />
            <Text style={styles.smallTitle}>Gå med</Text>
            <Text style={styles.smallSub}>Ange rumskod</Text>
          </Pressable>

          <Pressable style={styles.smallCard} onPress={() => openMode("solo")}>
            <Ionicons name="bulb-outline" size={28} color="#7DD3FC" />
            <Text style={styles.smallTitle}>Spela själv</Text>
            <Text style={styles.smallSub}>Quiz direkt</Text>
          </Pressable>
        </View>

        <Pressable style={styles.menuRow} onPress={() => openMode("quizmaster")}>
          <View style={styles.menuLeft}>
            <Ionicons name="mic-outline" size={23} color="#7DD3FC" />
            <View>
              <Text style={styles.menuTitle}>Quizmaster</Text>
              <Text style={styles.menuSub}>Styr spelet från mobilen</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
        </Pressable>

        <Pressable style={styles.menuRow} onPress={() => openMode("hall")}>
          <View style={styles.menuLeft}>
            <Ionicons name="trophy-outline" size={23} color="#FDE68A" />
            <View>
              <Text style={styles.menuTitle}>Hall of Fame</Text>
              <Text style={styles.menuSub}>Profiler, rivaler och resultat</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
        </Pressable>

        <View style={styles.spacer} />
        <Text style={styles.footer}>quiz.nilsson.ink</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#07111F" },
  home: { flex: 1, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18 },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  kicker: { color: "#7DD3FC", fontSize: 14, fontWeight: "900", letterSpacing: 2.2, marginBottom: 8 },
  title: { color: "#F8FAFC", fontSize: 38, lineHeight: 41, fontWeight: "900", letterSpacing: -1.4 },
  subtitle: { color: "#A8B5C7", fontSize: 16, lineHeight: 23, marginTop: 14, marginBottom: 24, maxWidth: 340 },
  logoBadge: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#7DD3FC", alignItems: "center", justifyContent: "center" },
  actionCard: { borderRadius: 24, minHeight: 105, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 },
  actionCardPrimary: { backgroundColor: "#7DD3FC" },
  actionIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.34)", alignItems: "center", justifyContent: "center" },
  actionText: { flex: 1 },
  actionTitlePrimary: { color: "#07111F", fontSize: 20, fontWeight: "900", marginBottom: 4 },
  actionSubPrimary: { color: "#203040", fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  smallCard: { flex: 1, minHeight: 142, backgroundColor: "#111D2D", borderWidth: 1, borderColor: "#203149", borderRadius: 22, padding: 17, justifyContent: "flex-end" },
  smallCardStrong: { backgroundColor: "#15263A" },
  smallTitle: { color: "#F8FAFC", fontWeight: "900", fontSize: 18, marginTop: 16, marginBottom: 4 },
  smallSub: { color: "#95A6BB", fontSize: 13 },
  menuRow: { minHeight: 70, borderRadius: 18, paddingHorizontal: 16, marginBottom: 10, backgroundColor: "#0D1826", borderWidth: 1, borderColor: "#19283D", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  menuLeft: { flexDirection: "row", gap: 13, alignItems: "center" },
  menuTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "800" },
  menuSub: { color: "#8496AC", fontSize: 12, marginTop: 3 },
  spacer: { flex: 1 },
  footer: { color: "#60748C", textAlign: "center", fontSize: 12, marginTop: 12 },
  topbar: { height: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#1D2C40" },
  topbarTitle: { flex: 1, color: "#F8FAFC", fontSize: 17, fontWeight: "800", textAlign: "center" },
  iconButton: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  webWrap: { flex: 1, backgroundColor: "#07111F" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(7,17,31,0.42)" },
  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  errorTitle: { color: "#F8FAFC", fontWeight: "900", fontSize: 24, marginTop: 18 },
  errorText: { color: "#A8B5C7", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8, marginBottom: 22 },
  primaryButton: { width: "100%", minHeight: 54, borderRadius: 17, backgroundColor: "#7DD3FC", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  primaryButtonText: { color: "#07111F", fontSize: 16, fontWeight: "900" },
  secondaryButton: { width: "100%", minHeight: 52, borderRadius: 17, borderWidth: 1, borderColor: "#334A66", alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#E2E8F0", fontSize: 15, fontWeight: "800" }
});
