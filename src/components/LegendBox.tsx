import * as d3 from "d3";
import React from "react";

interface LegendBoxProps {
  min: number;
  mid: number;
  max: number;
  colorScale: d3.ScaleLinear<number, string>;
}

export const LegendBox: React.FC<LegendBoxProps> = ({
  min,
  mid,
  max,
  colorScale,
}) => {
  const legendHeight = 180;
  const legendWidth = 28;
  const steps = 40;
  const values = d3
    .range(min, max, (max - min) / steps)
    .concat([max])
    .reverse();

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        padding: 16,
        display: "block",
        textAlign: "center",
        width: "100%",
        maxWidth: 200,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 16 }}>
        Legend
      </div>
      <svg width={legendWidth + 40} height={legendHeight + 10}>
        {/* Color bar (inverted) */}
        {values.map((v, i) => (
          <rect
            key={i}
            x={0}
            y={(legendHeight * i) / steps}
            width={legendWidth}
            height={legendHeight / steps + 1}
            fill={colorScale(v)}
          />
        ))}
        {/* Axis labels (inverted) */}
        <text x={legendWidth + 8} y={10} fontSize={12} fill="#444">
          Max: {Math.round(max).toString()}
        </text>
        <text
          x={legendWidth + 8}
          y={legendHeight / 2 + 5}
          fontSize={12}
          fill="#444"
        >
          Median: {Math.round(mid).toString()}
        </text>
        <text x={legendWidth + 8} y={legendHeight} fontSize={12} fill="#444">
          Min: {Math.round(min).toString()}
        </text>
      </svg>
    </div>
  );
};
