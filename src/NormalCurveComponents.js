// NormalCurveComponents.js
// ============================================================
// ระบบกราฟ Normal Curve วิเคราะห์ทักษะช่าง
// - IndividualSkillCurve (กราฟรายบุคคล)
// - CollectivePerformanceCurve (กราฟภาพรวมทีม)
// - MiniSkillIndicator (แถบเล็กๆ ในการ์ด)
// ============================================================

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Path, Circle, Line, Defs, LinearGradient, Stop, Rect, Text as SvgText, G
} from 'react-native-svg';
import { C, Card, Badge } from './Components';

const screenWidth = Dimensions.get('window').width;

// ============================================================
// ฟังก์ชันคำนวณทางสถิติ
// ============================================================

export function normalPDF(x, mean, stdDev) {
  if (stdDev === 0) return 0;
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) *
    Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
}

function calculateZScore(value, mean, stdDev) {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

function zScoreToPercentile(z) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * absZ);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ);

  return Math.round((0.5 * (1.0 + sign * y)) * 100);
}

function calculateStats(values) {
  if (!values || values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (values.length === 1) return { mean, stdDev: mean * 0.2 };
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return { mean, stdDev: stdDev || mean * 0.2 };
}

function generateCurvePath(mean, stdDev, width, height, padding) {
  const points = [];
  const xMin = mean - 4 * stdDev;
  const xMax = mean + 4 * stdDev;
  const steps = 100;
  const maxPDF = normalPDF(mean, mean, stdDev);

  for (let i = 0; i <= steps; i++) {
    const x = xMin + (xMax - xMin) * (i / steps);
    const y = normalPDF(x, mean, stdDev);
    const pixelX = padding + ((x - xMin) / (xMax - xMin)) * (width - 2 * padding);
    const pixelY = height - padding - (y / maxPDF) * (height - 2 * padding);
    points.push({ x: pixelX, y: pixelY });
  }

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }

  return { pathD, points, xMin, xMax, maxPDF };
}

function valueToPixelX(value, xMin, xMax, width, padding) {
  return padding + ((value - xMin) / (xMax - xMin)) * (width - 2 * padding);
}

function valueToPixelY(value, mean, stdDev, maxPDF, height, padding) {
  const y = normalPDF(value, mean, stdDev);
  return height - padding - (y / maxPDF) * (height - 2 * padding);
}

const SKILL_LEVELS = {
  low: { label: 'ต่ำกว่ามาตรฐาน', color: '#EF4444', bg: '#FEE2E2', emoji: '⚠️' },
  standard: { label: 'มาตรฐาน', color: '#10B981', bg: '#D1FAE5', emoji: '✅' },
  high: { label: 'สูงกว่ามาตรฐาน', color: '#3B82F6', bg: '#DBEAFE', emoji: '⭐' },
  elite: { label: 'หัวกะทิ', color: '#F59E0B', bg: '#FEF3C7', emoji: '🏆' },
};

function getSkillLevel(zScore) {
  if (zScore < -1) return SKILL_LEVELS.low;
  if (zScore < 0.5) return SKILL_LEVELS.standard;
  if (zScore < 1.5) return SKILL_LEVELS.high;
  return SKILL_LEVELS.elite;
}

// ============================================================
// 1. กราฟรายบุคคล
// ============================================================
export function IndividualSkillCurve({
  currentWorkerOutput, workTypeMean, workTypeSD,
  workerName = 'ช่าง', workTypeName = 'งาน', unit = 'หน่วย/วัน'
}) {
  const width = screenWidth - 64;
  const height = 200;
  const padding = 30;

  const effectiveSD = workTypeSD > 0 ? workTypeSD : workTypeMean * 0.25;
  const { pathD, xMin, xMax, maxPDF } = generateCurvePath(
    workTypeMean, effectiveSD, width, height, padding
  );

  const zScore = calculateZScore(currentWorkerOutput, workTypeMean, effectiveSD);
  const percentile = zScoreToPercentile(zScore);
  const skillLevel = getSkillLevel(zScore);

  const workerX = valueToPixelX(currentWorkerOutput, xMin, xMax, width, padding);
  const workerY = valueToPixelY(currentWorkerOutput, workTypeMean, effectiveSD, maxPDF, height, padding);

  const zone1X = valueToPixelX(workTypeMean - effectiveSD, xMin, xMax, width, padding);
  const zone2X = valueToPixelX(workTypeMean + 0.5 * effectiveSD, xMin, xMax, width, padding);
  const zone3X = valueToPixelX(workTypeMean + 1.5 * effectiveSD, xMin, xMax, width, padding);

  const areaPathD = `${pathD} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <Card style={{ marginVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Ionicons name="analytics-outline" size={20} color={C.primary} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginLeft: 8 }}>
          วิเคราะห์ทักษะ: {workTypeName}
        </Text>
      </View>

      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#EF4444" stopOpacity="0.3" />
            <Stop offset="0.3" stopColor="#10B981" stopOpacity="0.3" />
            <Stop offset="0.6" stopColor="#3B82F6" stopOpacity="0.3" />
            <Stop offset="1" stopColor="#F59E0B" stopOpacity="0.3" />
          </LinearGradient>
        </Defs>

        <Path d={areaPathD} fill="url(#curveGradient)" />
        <Path d={pathD} stroke="#6B7280" strokeWidth={2.5} fill="none" />

        <Line x1={zone1X} y1={padding} x2={zone1X} y2={height - padding}
          stroke="#EF4444" strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />
        <Line x1={zone2X} y1={padding} x2={zone2X} y2={height - padding}
          stroke="#3B82F6" strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />
        <Line x1={zone3X} y1={padding} x2={zone3X} y2={height - padding}
          stroke="#F59E0B" strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />

        <Line x1={valueToPixelX(workTypeMean, xMin, xMax, width, padding)}
          y1={padding}
          x2={valueToPixelX(workTypeMean, xMin, xMax, width, padding)}
          y2={height - padding}
          stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="6,3" />

        <Line x1={workerX} y1={workerY} x2={workerX} y2={height - padding}
          stroke={skillLevel.color} strokeWidth={2.5} />
        <Circle cx={workerX} cy={workerY} r={10} fill={skillLevel.color} />
        <Circle cx={workerX} cy={workerY} r={6} fill="#fff" />
        <Circle cx={workerX} cy={workerY} r={4} fill={skillLevel.color} />

        <SvgText x={padding} y={height - 8} fontSize={10} fill="#9CA3AF" textAnchor="start">
          {Math.round(xMin)}
        </SvgText>
        <SvgText x={valueToPixelX(workTypeMean, xMin, xMax, width, padding)} y={height - 8}
          fontSize={10} fill="#6B7280" textAnchor="middle" fontWeight="bold">
          μ={workTypeMean.toFixed(1)}
        </SvgText>
        <SvgText x={width - padding} y={height - 8} fontSize={10} fill="#9CA3AF" textAnchor="end">
          {Math.round(xMax)}
        </SvgText>
      </Svg>

      <View style={{
        backgroundColor: skillLevel.bg, borderRadius: 12, padding: 14, marginTop: 12,
        borderWidth: 1, borderColor: skillLevel.color + '40'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 24, marginRight: 8 }}>{skillLevel.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: skillLevel.color }}>
              {skillLevel.label}
            </Text>
            <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
              {workerName} ทำได้ {currentWorkerOutput.toFixed(1)} {unit}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: skillLevel.color }}>
              {percentile}%
            </Text>
            <Text style={{ fontSize: 10, color: C.textSec }}>Percentile</Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: skillLevel.color + '30', marginVertical: 8 }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 11, color: C.textSec }}>ค่าเฉลี่ย (μ)</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{workTypeMean.toFixed(1)}</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 11, color: C.textSec }}>ส่วนเบี่ยงเบน (σ)</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{effectiveSD.toFixed(1)}</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 11, color: C.textSec }}>Z-Score</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: skillLevel.color }}>
              {zScore >= 0 ? '+' : ''}{zScore.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

// ============================================================
// 2. กราฟภาพรวมทีม
// ============================================================
export function CollectivePerformanceCurve({
  workersData, workTypeMean, workTypeSD,
  workTypeName = 'งาน', unit = 'หน่วย/วัน', onWorkerPress
}) {
  const [selectedWorker, setSelectedWorker] = useState(null);

  const width = screenWidth - 64;
  const height = 260;
  const padding = 35;

  const effectiveSD = workTypeSD > 0 ? workTypeSD : workTypeMean * 0.25;
  const { pathD, xMin, xMax, maxPDF } = generateCurvePath(
    workTypeMean, effectiveSD, width, height, padding
  );

  const meanX = valueToPixelX(workTypeMean, xMin, xMax, width, padding);

  const workersOnCurve = workersData.map(w => {
    const zScore = calculateZScore(w.output, workTypeMean, effectiveSD);
    const percentile = zScoreToPercentile(zScore);
    const skillLevel = getSkillLevel(zScore);
    const clampedOutput = Math.max(xMin, Math.min(xMax, w.output));
    return {
      ...w, zScore, percentile, skillLevel,
      x: valueToPixelX(clampedOutput, xMin, xMax, width, padding),
      y: valueToPixelY(clampedOutput, workTypeMean, effectiveSD, maxPDF, height, padding),
    };
  });

  const topPerformers = [...workersOnCurve]
    .filter(w => w.zScore >= 0.5)
    .sort((a, b) => b.output - a.output).slice(0, 3);

  const needsSupport = [...workersOnCurve]
    .filter(w => w.zScore < -0.5)
    .sort((a, b) => a.output - b.output).slice(0, 3);

  const handleWorkerPress = (worker) => {
    setSelectedWorker(worker.id === selectedWorker?.id ? null : worker);
    if (onWorkerPress) onWorkerPress(worker);
  };

  return (
    <Card style={{ marginVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Ionicons name="people-outline" size={20} color={C.primary} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginLeft: 8 }}>
          ภาพรวมทีม: {workTypeName}
        </Text>
        <View style={{ flex: 1 }} />
        <Badge label={`${workersData.length} คน`} color={C.primary} bg={C.primary + '15'} />
      </View>

      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="leftArea" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#EF4444" stopOpacity="0.15" />
            <Stop offset="1" stopColor="#EF4444" stopOpacity="0.05" />
          </LinearGradient>
          <LinearGradient id="rightArea" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#10B981" stopOpacity="0.05" />
            <Stop offset="1" stopColor="#10B981" stopOpacity="0.15" />
          </LinearGradient>
        </Defs>

        <Rect x={padding} y={padding} width={meanX - padding} height={height - 2 * padding}
          fill="url(#leftArea)" />
        <Rect x={meanX} y={padding} width={width - padding - meanX} height={height - 2 * padding}
          fill="url(#rightArea)" />

        <Path d={pathD} stroke="#6B7280" strokeWidth={3} fill="none" />

        <Line x1={meanX} y1={padding - 10} x2={meanX} y2={height - padding + 5}
          stroke="#6B7280" strokeWidth={2} strokeDasharray="6,3" />

        <SvgText x={padding + 10} y={padding + 15} fontSize={10} fill="#EF4444" fontWeight="600">
          ต้องพัฒนา
        </SvgText>
        <SvgText x={width - padding - 10} y={padding + 15} fontSize={10} fill="#10B981"
          fontWeight="600" textAnchor="end">
          ดีเยี่ยม
        </SvgText>

        {workersOnCurve.map((w) => {
          const isSelected = selectedWorker?.id === w.id;
          return (
            <G key={w.id}>
              {isSelected && (
                <Line x1={w.x} y1={w.y} x2={w.x} y2={height - padding}
                  stroke={w.skillLevel.color} strokeWidth={1.5} strokeDasharray="3,3" />
              )}
              <Circle cx={w.x} cy={w.y}
                r={isSelected ? 14 : 8}
                fill={w.skillLevel.color}
                opacity={isSelected ? 1 : 0.85}
                onPress={() => handleWorkerPress(w)} />
              <Circle cx={w.x} cy={w.y}
                r={isSelected ? 8 : 4}
                fill="#fff"
                onPress={() => handleWorkerPress(w)} />
            </G>
          );
        })}

        <SvgText x={padding} y={height - 5} fontSize={9} fill="#9CA3AF" textAnchor="start">
          {Math.round(xMin)}
        </SvgText>
        <SvgText x={meanX} y={height - 5} fontSize={10} fill="#6B7280"
          textAnchor="middle" fontWeight="bold">
          μ={workTypeMean.toFixed(1)}
        </SvgText>
        <SvgText x={width - padding} y={height - 5} fontSize={9} fill="#9CA3AF" textAnchor="end">
          {Math.round(xMax)}
        </SvgText>
      </Svg>

      {selectedWorker && (
        <View style={{
          backgroundColor: selectedWorker.skillLevel.bg,
          borderRadius: 10, padding: 12, marginTop: 8,
          borderWidth: 1, borderColor: selectedWorker.skillLevel.color + '40'
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, marginRight: 8 }}>👷</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
                {selectedWorker.name}
              </Text>
              <Text style={{ fontSize: 12, color: C.textSec }}>
                ผลผลิต: {selectedWorker.output.toFixed(1)} {unit}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Badge label={selectedWorker.skillLevel.label}
                color={selectedWorker.skillLevel.color}
                bg={selectedWorker.skillLevel.bg} />
              <Text style={{ fontSize: 11, color: C.textSec, marginTop: 4 }}>
                Percentile: {selectedWorker.percentile}%
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <View style={{ flex: 1, backgroundColor: '#D1FAE5', borderRadius: 12, padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 16 }}>🏆</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#059669', marginLeft: 6 }}>
              Top Performers
            </Text>
          </View>
          {topPerformers.length > 0 ? topPerformers.map((w, i) => (
            <TouchableOpacity key={w.id} onPress={() => handleWorkerPress(w)}
              style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
                borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#A7F3D0'
              }}>
              <Text style={{ fontSize: 14, width: 20 }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
              </Text>
              <Text style={{ flex: 1, fontSize: 12, color: C.text, fontWeight: '600' }}
                numberOfLines={1}>{w.name}</Text>
              <Text style={{ fontSize: 11, color: '#059669', fontWeight: '700' }}>
                {w.output.toFixed(1)}
              </Text>
            </TouchableOpacity>
          )) : (
            <Text style={{ fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
              ยังไม่มีข้อมูล
            </Text>
          )}
        </View>

        <View style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 16 }}>📋</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#DC2626', marginLeft: 6 }}>
              ต้องช่วยเหลือ
            </Text>
          </View>
          {needsSupport.length > 0 ? needsSupport.map((w, i) => (
            <TouchableOpacity key={w.id} onPress={() => handleWorkerPress(w)}
              style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
                borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#FECACA'
              }}>
              <Ionicons name="alert-circle" size={14} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={{ flex: 1, fontSize: 12, color: C.text, fontWeight: '600' }}
                numberOfLines={1}>{w.name}</Text>
              <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '700' }}>
                {w.output.toFixed(1)}
              </Text>
            </TouchableOpacity>
          )) : (
            <Text style={{ fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
              ไม่มีใครต้องช่วยเหลือ 🎉
            </Text>
          )}
        </View>
      </View>

      <View style={{
        flexDirection: 'row', justifyContent: 'center', gap: 16,
        marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB'
      }}>
        {Object.entries(SKILL_LEVELS).map(([key, level]) => (
          <View key={key} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: level.color, marginRight: 4
            }} />
            <Text style={{ fontSize: 10, color: C.textSec }}>{level.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ============================================================
// 3. Mini Indicator
// ============================================================
export function MiniSkillIndicator({ output, mean, stdDev, width = 80 }) {
  const effectiveSD = stdDev > 0 ? stdDev : mean * 0.25;
  const zScore = calculateZScore(output, mean, effectiveSD);
  const skillLevel = getSkillLevel(zScore);
  const percentile = zScoreToPercentile(zScore);
  const position = Math.max(0, Math.min(100, ((zScore + 3) / 6) * 100));

  return (
    <View style={{ width, alignItems: 'center' }}>
      <View style={{
        width: '100%', height: 6, borderRadius: 3,
        backgroundColor: '#E5E7EB', overflow: 'hidden'
      }}>
        <View style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: '33%', backgroundColor: '#FEE2E2'
        }} />
        <View style={{
          position: 'absolute', left: '33%', top: 0, height: '100%',
          width: '34%', backgroundColor: '#D1FAE5'
        }} />
        <View style={{
          position: 'absolute', left: '67%', top: 0, height: '100%',
          width: '33%', backgroundColor: '#FEF3C7'
        }} />
        <View style={{
          position: 'absolute', left: `${position}%`, top: -2,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: skillLevel.color,
          borderWidth: 2, borderColor: '#fff',
          transform: [{ translateX: -5 }]
        }} />
      </View>
      <Text style={{ fontSize: 9, color: skillLevel.color, marginTop: 4, fontWeight: '600' }}>
        P{percentile}
      </Text>
    </View>
  );
}

export { calculateStats, calculateZScore, zScoreToPercentile, getSkillLevel };