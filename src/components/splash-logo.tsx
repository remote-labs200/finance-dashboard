/**
 * SplashLogo — Custom techno-geometric "PaySmooth" wordmark
 *
 * Each letter is constructed from rectangular View segments to achieve:
 * - Sharp, blocked angles with uniform line weight
 * - Square, squared-off edges (no curves)
 * - 'A' as inverted V without crossbar
 * - 'X' with asymmetrical notch on upper-left arm
 * - All caps, uniform stroke weight (techno-geometric)
 *
 * Tagline "Your income, smoothed." uses segment-based serif:
 * - All lowercase
 * - High stroke contrast (thin/thick)
 * - Traditional, stable anchor below the tech-forward wordmark
 */

import { StyleSheet, View } from "react-native";

// ─── Constants ──────────────────────────────────────────────────────────────

const S = 5; // stroke thickness (base unit)
const LH = 48; // letter height
const LW = 32; // letter width
const G = 6; // gap between letters

// ─── Segment helpers ────────────────────────────────────────────────────────

type Seg = { w: number; h: number; x: number; y: number };

function seg(w: number, h: number, x: number, y: number): Seg {
  return { w, h, x, y };
}

function Box({ s, color }: { s: Seg; color: string }) {
  return (
    <View
      style={{
        position: "absolute",
        left: s.x,
        top: s.y,
        width: s.w,
        height: s.h,
        backgroundColor: color,
      }}
    />
  );
}

function Letter({ segs, color }: { segs: Seg[]; color: string }) {
  return (
    <View style={{ width: LW, height: LH, position: "relative" }}>
      {segs.map((s, i) => (
        <Box key={i} s={s} color={color} />
      ))}
    </View>
  );
}

// ─── Letter definitions ─────────────────────────────────────────────────────

// S — three horizontal bars + short verticals at top-left and bottom-right
const _S: Seg[] = [
  seg(LW, S, 0, 0), // top bar
  seg(S, LH / 2 - S, 0, S), // upper-left vertical
  seg(LW, S, 0, LH / 2 - S / 2), // middle bar
  seg(S, LH / 2 - S, LW - S, LH / 2 + S / 2), // lower-right vertical
  seg(LW, S, 0, LH - S), // bottom bar
];

// M — stepped diagonals between two outer verticals
const _M: Seg[] = [
  seg(S, LH, 0, 0), // left |
  seg(S, S, S * 2, S * 3), // step diag down-right
  seg(S, S, S * 3, S * 4),
  seg(S, S, S * 2, LH - S * 4), // step diag up-right
  seg(S, S, S * 3, LH - S * 3),
  seg(S, LH, LW - S, 0), // right |
];

// O — four-sided square frame
const _O: Seg[] = [
  seg(LW, S, 0, 0), // top
  seg(S, LH, 0, 0), // left
  seg(S, LH, LW - S, 0), // right
  seg(LW, S, 0, LH - S), // bottom
];

// T — wide top bar + center stem
const _T: Seg[] = [
  seg(LW, S, 0, 0), // top bar
  seg(S, LH, LW / 2 - S / 2, 0), // center stem
];

// H — two verticals + middle horizontal
const _H: Seg[] = [
  seg(S, LH, 0, 0), // left |
  seg(S, LH, LW - S, 0), // right |
  seg(LW - S * 2, S, S, LH / 2 - S / 2), // middle —
];

// A — stepped Λ shape, NO crossbar
const _A: Seg[] = [
  // Left diagonal (stepped)
  seg(S, S, 0, 0),
  seg(S, S, S, S * 2),
  seg(S, S, S * 2, S * 4),
  seg(S, S, S, S * 6),
  seg(S, S, 0, S * 8),
  // Right diagonal (stepped)
  seg(S, S, LW - S, 0),
  seg(S, S, LW - S * 2, S * 2),
  seg(S, S, LW - S * 3, S * 4),
  seg(S, S, LW - S * 2, S * 6),
  seg(S, S, LW - S, S * 8),
];

// X — crossed diagonals + notch on upper-left arm
const _X: Seg[] = [
  // Left arm (╲) — upper segment offset creates notch
  seg(S, S, 0, 0), // top-left stub
  seg(S, S, 0, S * 2),
  seg(S, S, S, S * 4),
  seg(S, S, S, S * 6),
  seg(S, S, 0, S * 8),
  // Notch — fills the gap in the upper-left arm
  seg(S / 2, S * 2, 0, S), // notch overlay
  // Right arm (╱)
  seg(S, S, LW - S, 0),
  seg(S, S, LW - S, S * 2),
  seg(S, S, LW - S * 2, S * 4),
  seg(S, S, LW - S * 2, S * 6),
  seg(S, S, LW - S, S * 8),
];

// ─── Tagline "Your income, smoothed." ──────────────────────────────────────
// Each character built from small View segments (serif-style)

function TagSegment({
  w,
  h,
  x,
  y,
  c,
}: {
  w: number;
  h: number;
  x: number;
  y: number;
  c: string;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        backgroundColor: c,
        borderRadius: 0.5,
      }}
    />
  );
}

function TagChar({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ width: 14, height: 10, position: "relative" }}>
      {children}
    </View>
  );
}

function TagSpace({ width = 6 }: { width?: number }) {
  return <View style={{ width }} />;
}

function Tagline({ color }: { color: string }) {
  const T = (p: { w: number; h: number; x: number; y: number }) => (
    <TagSegment w={p.w} h={p.h} x={p.x} y={p.y} c={color} />
  );

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 12 }}>
      {/* Y */}
      <TagChar>
        <T w={14} h={2} x={0} y={0} />
        <T w={2} h={12} x={6} y={2} />
        <T w={14} h={2} x={0} y={12} />
      </TagChar>
      {/* o */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={10} h={2} x={2} y={0} />
        <T w={2} h={8} x={10} y={0} />
        <T w={10} h={2} x={2} y={6} />
      </TagChar>
      {/* u */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={10} h={2} x={2} y={6} />
        <T w={2} h={8} x={10} y={0} />
      </TagChar>
      {/* r */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={8} h={2} x={2} y={0} />
      </TagChar>
      <TagSpace />
      {/* i */}
      <TagChar>
        <T w={2} h={2} x={4} y={0} />
        <T w={2} h={8} x={4} y={2} />
        <T w={6} h={2} x={2} y={8} />
      </TagChar>
      {/* n */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={8} h={2} x={2} y={0} />
        <T w={2} h={8} x={8} y={2} />
      </TagChar>
      {/* c */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={8} h={2} x={2} y={0} />
        <T w={8} h={2} x={2} y={6} />
      </TagChar>
      {/* o */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={10} h={2} x={2} y={0} />
        <T w={2} h={8} x={10} y={0} />
        <T w={10} h={2} x={2} y={6} />
      </TagChar>
      {/* m */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={2} h={8} x={6} y={0} />
        <T w={2} h={8} x={12} y={0} />
        <T w={4} h={2} x={2} y={0} />
        <T w={4} h={2} x={8} y={0} />
      </TagChar>
      {/* e */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={10} h={2} x={2} y={0} />
        <T w={8} h={2} x={2} y={3} />
        <T w={10} h={2} x={2} y={6} />
      </TagChar>
      {/* , */}
      <TagChar>
        <T w={2} h={3} x={4} y={7} />
      </TagChar>
      <TagSpace />
      {/* s */}
      <TagChar>
        <T w={8} h={2} x={2} y={0} />
        <T w={2} h={3} x={0} y={2} />
        <T w={8} h={2} x={2} y={3} />
        <T w={2} h={3} x={8} y={5} />
        <T w={8} h={2} x={2} y={6} />
      </TagChar>
      {/* m */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={2} h={8} x={6} y={0} />
        <T w={2} h={8} x={12} y={0} />
        <T w={4} h={2} x={2} y={0} />
        <T w={4} h={2} x={8} y={0} />
      </TagChar>
      {/* o */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={10} h={2} x={2} y={0} />
        <T w={2} h={8} x={10} y={0} />
        <T w={10} h={2} x={2} y={6} />
      </TagChar>
      {/* o */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={10} h={2} x={2} y={0} />
        <T w={2} h={8} x={10} y={0} />
        <T w={10} h={2} x={2} y={6} />
      </TagChar>
      {/* t */}
      <TagChar>
        <T w={8} h={2} x={2} y={0} />
        <T w={2} h={8} x={4} y={2} />
      </TagChar>
      {/* h */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={10} h={2} x={2} y={3} />
        <T w={2} h={8} x={10} y={0} />
      </TagChar>
      {/* e */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={10} h={2} x={2} y={0} />
        <T w={8} h={2} x={2} y={3} />
        <T w={10} h={2} x={2} y={6} />
      </TagChar>
      {/* d */}
      <TagChar>
        <T w={2} h={8} x={0} y={0} />
        <T w={2} h={8} x={10} y={0} />
        <T w={10} h={2} x={2} y={0} />
        <T w={10} h={2} x={2} y={6} />
        <T w={4} h={2} x={8} y={8} />
      </TagChar>
      {/* . */}
      <TagChar>
        <T w={2} h={2} x={4} y={8} />
      </TagChar>
    </View>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

interface SplashLogoProps {
  wordmarkColor?: string;
  taglineColor?: string;
  compact?: boolean;
}

export function SplashLogo({
  wordmarkColor = "#ffffff",
  taglineColor = "rgba(255,255,255,0.75)",
  compact = false,
}: SplashLogoProps) {
  return (
    <View style={[styles.wrapper, compact && { transform: [{ scale: 0.6 }] }]}>
      {/* Wordmark row — S M O O T H A X */}
      <View style={styles.wordmarkRow}>
        <Letter segs={_S} color={wordmarkColor} />
        <View style={{ width: G }} />
        <Letter segs={_M} color={wordmarkColor} />
        <View style={{ width: G }} />
        <Letter segs={_O} color={wordmarkColor} />
        <View style={{ width: G }} />
        <Letter segs={_O} color={wordmarkColor} />
        <View style={{ width: G }} />
        <Letter segs={_T} color={wordmarkColor} />
        <View style={{ width: G }} />
        <Letter segs={_H} color={wordmarkColor} />
        <View style={{ width: G }} />
        <Letter segs={_A} color={wordmarkColor} />
        <View style={{ width: G }} />
        <Letter segs={_X} color={wordmarkColor} />
      </View>

      {/* Tagline */}
      <View style={styles.taglineSection}>
        <View
          style={[styles.divider, { backgroundColor: wordmarkColor + "40" }]}
        />
        <Tagline color={taglineColor} />
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: LH,
  },
  taglineSection: {
    marginTop: 28,
    alignItems: "center",
  },
  divider: {
    width: 40,
    height: 2,
    marginBottom: 14,
  },
});
