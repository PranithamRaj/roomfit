import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { checkFit, parseSpace } from '../lib/fit';
import { colors, radius, space as sp } from '../theme';
import { Card, Chip, Field, H2, Muted } from './ui';

const CLEARANCES = [0, 5, 15, 30];
const DIAGRAM = 240; // px

export default function FitChecker({ dimensions }) {
  const [input, setInput] = useState({ width: '', depth: '', height: '' });
  const [clearance, setClearance] = useState(5);

  const room = useMemo(() => parseSpace(input), [input]);
  const result = useMemo(() => (room ? checkFit(dimensions, room, clearance) : null), [room, clearance, dimensions]);

  const set = (k) => (v) => setInput((s) => ({ ...s, [k]: v.replace(/[^0-9.,]/g, '') }));

  return (
    <Card>
      <View style={styles.headerRow}>
        <Ionicons name="resize-outline" size={20} color={colors.accent} />
        <H2 style={{ marginLeft: 6 }}>Will it fit?</H2>
      </View>
      <Muted style={{ marginBottom: sp(3) }}>
        Measure the spot in your room with a tape measure, or check it in AR first.
      </Muted>

      <View style={styles.inputs}>
        <Field style={styles.input} label="Width (cm)" keyboardType="decimal-pad" value={input.width} onChangeText={set('width')} placeholder="e.g. 240" />
        <Field style={styles.input} label="Depth (cm)" keyboardType="decimal-pad" value={input.depth} onChangeText={set('depth')} placeholder="e.g. 110" />
        <Field style={styles.input} label="Height" keyboardType="decimal-pad" value={input.height} onChangeText={set('height')} placeholder="optional" />
      </View>

      <Text style={styles.label}>Spare room around it</Text>
      <View style={styles.chips}>
        {CLEARANCES.map((c) => (
          <Chip key={c} label={c === 0 ? 'Snug' : `${c} cm`} active={clearance === c} onPress={() => setClearance(c)} />
        ))}
      </View>

      {result && (
        <>
          <View style={[styles.verdict, { backgroundColor: result.fits ? colors.successSoft : colors.dangerSoft }]}>
            <Ionicons name={result.fits ? 'checkmark-circle' : 'close-circle'} size={22} color={result.fits ? colors.success : colors.danger} />
            <Text style={[styles.verdictText, { color: result.fits ? colors.success : colors.danger }]}>
              {result.fits ? (result.rotated ? 'Fits if you turn it 90°' : 'It fits!') : "It won't fit this space"}
            </Text>
          </View>

          {result.rows.map((r) => (
            <View key={r.key} style={styles.row}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowVal}>needs {r.need} cm · you have {r.have} cm</Text>
              <Text style={[styles.rowMargin, { color: r.ok ? colors.success : colors.danger }]}>
                {r.ok ? `+${r.margin}` : r.margin} cm
              </Text>
            </View>
          ))}

          <FloorPlan space={room} dimensions={dimensions} rotated={result.rotated} fits={result.fits} />
        </>
      )}
    </Card>
  );
}

// Top-down sketch: the measured space (dashed) with the product footprint against the back wall.
function FloorPlan({ space, dimensions, rotated, fits }) {
  const pw = rotated ? dimensions.depth : dimensions.width;
  const pd = rotated ? dimensions.width : dimensions.depth;
  const scale = DIAGRAM / Math.max(space.width, space.depth, pw, pd);
  const tone = fits ? colors.success : colors.danger;
  const boxW = Math.max(space.width, pw) * scale;

  return (
    <View style={{ alignItems: 'center', marginTop: sp(4) }}>
      <Muted style={{ fontSize: 12, marginBottom: 6 }}>Top-down view · wall at the top</Muted>
      <View style={{ width: boxW, height: Math.max(space.depth, pd) * scale }}>
        <View style={[styles.space, { width: space.width * scale, height: space.depth * scale, left: (boxW - space.width * scale) / 2 }]}>
          <Text style={styles.spaceLabel}>{space.width} × {space.depth}</Text>
        </View>
        <View
          style={[
            styles.product,
            {
              width: pw * scale,
              height: pd * scale,
              left: (boxW - pw * scale) / 2,
              borderColor: tone,
              backgroundColor: fits ? 'rgba(47,125,79,0.18)' : 'rgba(179,38,30,0.18)',
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  inputs: { flexDirection: 'row', gap: 8 },
  input: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  verdict: { flexDirection: 'row', alignItems: 'center', padding: sp(3), borderRadius: radius.sm, marginTop: sp(2), marginBottom: sp(2) },
  verdictText: { marginLeft: 8, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowLabel: { width: 60, fontWeight: '600', color: colors.ink },
  rowVal: { flex: 1, color: colors.muted, fontSize: 13 },
  rowMargin: { fontWeight: '700', fontSize: 13 },
  space: { position: 'absolute', top: 0, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.muted, borderRadius: 4, justifyContent: 'flex-end', alignItems: 'center' },
  spaceLabel: { fontSize: 11, color: colors.muted, marginBottom: 2 },
  product: { position: 'absolute', top: 0, borderWidth: 2, borderRadius: 4 },
});
