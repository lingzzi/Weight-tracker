import { useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  convertToDisplay,
  DEFAULT_CHART_WINDOW,
  formatDateLabel,
  formatWeight,
  getYAxisRange,
} from '../src/weight';
import type { WeightEntry, WeightUnit } from '../src/types';

const CHART_HEIGHT = 290;
const PLOT_LEFT = 48;
const PLOT_RIGHT = 12;
const PLOT_TOP = 18;
const PLOT_BOTTOM = 48;
const POINT_HIT_RADIUS = 26;

interface Viewport {
  start: number;
  size: number;
  count: number;
}

interface WeightChartProps {
  entries: WeightEntry[];
  goalKg: number;
  unit: WeightUnit;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}

function fitViewport(viewport: Viewport, count: number): Viewport {
  if (count === 0) return { start: 0, size: 0, count: 0 };
  const wasAtNewest = viewport.start + viewport.size >= viewport.count - 1;
  const minSize = Math.min(count, DEFAULT_CHART_WINDOW);
  const size = Math.max(minSize, Math.min(viewport.size || minSize, count));
  const start = count > viewport.count && wasAtNewest
    ? count - size
    : Math.max(0, Math.min(viewport.start, count - size));
  return { start, size, count };
}

function measureTouchDistance(touches: readonly { pageX: number; pageY: number }[]): number {
  const first = touches[0];
  const second = touches[1];
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

export default function WeightChart({
  entries,
  goalKg,
  unit,
  selectedIndex,
  onSelect,
}: WeightChartProps) {
  const initialSize = Math.min(entries.length, DEFAULT_CHART_WINDOW);
  const [viewportState, setViewportState] = useState<Viewport>({
    start: Math.max(0, entries.length - initialSize),
    size: initialSize,
    count: entries.length,
  });
  const [width, setWidth] = useState(0);
  const viewport = fitViewport(viewportState, entries.length);
  const gestureRef = useRef<{
    startX: number;
    startViewport: Viewport;
    pinchDistance: number | null;
    pinchCenter: number;
    moved: boolean;
  } | null>(null);

  const updateViewport = (next: Viewport) => {
    setViewportState(fitViewport({
      start: Math.round(next.start),
      size: Math.round(next.size),
      count: entries.length,
    }, entries.length));
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const plotWidth = Math.max(0, width - PLOT_LEFT - PLOT_RIGHT);
  const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const yRange = getYAxisRange(entries, goalKg, unit);
  const selectedEntry = selectedIndex === null ? null : entries[selectedIndex] ?? null;
  const start = Math.max(0, viewport.start);
  const end = Math.min(entries.length, start + viewport.size);
  const visible = entries.slice(start, end);

  const xForIndex = (index: number) => (
    PLOT_LEFT + ((index - start + 0.5) / Math.max(viewport.size, 1)) * plotWidth
  );
  const yForValue = (value: number) => (
    PLOT_TOP + ((yRange.max - value) / Math.max(yRange.max - yRange.min, 0.0001)) * plotHeight
  );

  const path = visible.map((entry, visibleIndex) => {
    const index = start + visibleIndex;
    const x = xForIndex(index);
    const y = yForValue(entry.weight * (unit === 'g' ? 1000 : 1));
    return `${visibleIndex === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = yRange.min + ((yRange.max - yRange.min) * index) / 4;
    return { value, y: yForValue(value) };
  });
  const labelIndices = visible.length <= 5
    ? visible.map((_, index) => start + index)
    : Array.from({ length: 5 }, (_, index) => (
      start + Math.round((visible.length - 1) * index / 4)
    ));

  const handleTouchStart = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;
    const current = viewport;
    gestureRef.current = {
      startX: event.nativeEvent.locationX,
      startViewport: current,
      pinchDistance: touches.length >= 2 ? measureTouchDistance(touches) : null,
      pinchCenter: current.start + current.size / 2,
      moved: false,
    };
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    const initial = gestureRef.current;
    if (!initial || entries.length === 0) return;
    const touches = event.nativeEvent.touches;
    if (touches.length >= 2) {
      const distance = measureTouchDistance(touches);
      if (!initial.pinchDistance) {
        initial.pinchDistance = distance;
        initial.startViewport = viewport;
        initial.pinchCenter = viewport.start + viewport.size / 2;
        initial.moved = true;
        return;
      }
      const size = initial.startViewport.size * initial.pinchDistance / Math.max(distance, 1);
      initial.moved = true;
      updateViewport({ start: initial.pinchCenter - size / 2, size, count: entries.length });
      return;
    }

    if (initial.pinchDistance !== null) return;
    const deltaX = event.nativeEvent.locationX - initial.startX;
    if (Math.abs(deltaX) > 6) {
      initial.moved = true;
      const entriesPerPixel = initial.startViewport.size / Math.max(plotWidth, 1);
      updateViewport({
        start: initial.startViewport.start - deltaX * entriesPerPixel,
        size: initial.startViewport.size,
        count: entries.length,
      });
    }
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    const initial = gestureRef.current;
    gestureRef.current = null;
    if (!initial || initial.moved || entries.length === 0 || plotWidth === 0) return;

    const changedTouch = event.nativeEvent.changedTouches[0];
    const touchX = changedTouch?.locationX ?? event.nativeEvent.locationX;
    const touchY = changedTouch?.locationY ?? event.nativeEvent.locationY;
    let nearestIndex: number | null = null;
    let nearestDistance = POINT_HIT_RADIUS;
    visible.forEach((entry, visibleIndex) => {
      const index = start + visibleIndex;
      const xDistance = touchX - xForIndex(index);
      const yDistance = touchY - yForValue(entry.weight * (unit === 'g' ? 1000 : 1));
      const distance = Math.hypot(xDistance, yDistance);
      if (distance <= nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    onSelect(nearestIndex);
  };

  return (
    <View
      style={styles.container}
      onLayout={handleLayout}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        gestureRef.current = null;
      }}
      accessibilityRole="image"
      accessibilityLabel="Interactive weight chart. Drag to pan, pinch to zoom, and tap a point to select it."
    >
      {width > 0 && (
        <Svg width={width} height={CHART_HEIGHT}>
          {yTicks.map((tick, index) => (
            <SvgText
              key={`y-${index}`}
              x={PLOT_LEFT - 8}
              y={tick.y + 4}
              fill="#5f6368"
              fontFamily="Poppins_400Regular"
              fontSize={10}
              textAnchor="end"
            >
              {formatWeight(tick.value, unit)}
            </SvgText>
          ))}
          {convertToDisplay(goalKg, unit) >= yRange.min
            && convertToDisplay(goalKg, unit) <= yRange.max && (
              <>
                <Line
                  x1={PLOT_LEFT}
                  x2={width - PLOT_RIGHT - 100}
                  y1={yForValue(convertToDisplay(goalKg, unit))}
                  y2={yForValue(convertToDisplay(goalKg, unit))}
                  stroke="#A9AEBB"
                  strokeWidth={0.75}
                  strokeDasharray="5 5"
                />
                <SvgText
                  x={width - PLOT_RIGHT}
                  y={yForValue(convertToDisplay(goalKg, unit)) + 3}
                  fill="#5B59FF"
                  fontFamily="Poppins_500Medium"
                  fontSize={9}
                  textAnchor="end"
                >
                  {`Goal: ${formatWeight(convertToDisplay(goalKg, unit), unit)}`}
                </SvgText>
              </>
            )}
          {path ? (
            <Path d={path} fill="none" stroke="#666666" strokeWidth={1.5} strokeDasharray="4 4" />
          ) : null}
          {visible.map((entry, visibleIndex) => {
            const index = start + visibleIndex;
            return (
              <Circle
                key={`${entry.iso}-${index}`}
                cx={xForIndex(index)}
                cy={yForValue(entry.weight * (unit === 'g' ? 1000 : 1))}
                r={selectedIndex === index ? 6 : 3.5}
                fill={selectedIndex === index ? '#5B59FF' : '#666666'}
                stroke="#ffffff"
                strokeWidth={selectedIndex === index ? 2 : 0}
              />
            );
          })}
          {labelIndices.map((index) => (
            <SvgText
              key={`x-${index}`}
              x={xForIndex(index)}
              y={CHART_HEIGHT - 13}
              fill="#5f6368"
              fontFamily="Poppins_400Regular"
              fontSize={9}
              textAnchor="middle"
            >
              {formatDateLabel(entries[index].iso)}
            </SvgText>
          ))}
        </Svg>
      )}
      {selectedEntry && (
        <View pointerEvents="none" style={styles.tooltip}>
          <Text style={styles.tooltipText}>{formatDateLabel(selectedEntry.iso)}</Text>
          <Text style={styles.tooltipValue}>
            {formatWeight(convertToDisplay(selectedEntry.weight, unit), unit)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: CHART_HEIGHT,
  },
  tooltip: {
    position: 'absolute',
    top: 4,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  tooltipText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 9,
    color: '#666A73',
  },
  tooltipValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#1C1E21',
  },
});
