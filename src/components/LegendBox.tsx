import * as d3 from "d3";
import React from "react";

interface LegendBoxProps {
  min: number;
  mid: number;
  max: number;
  colorScale: d3.ScaleLinear<number, string>;
  isMobile?: boolean;
}

export const LegendBox: React.FC<LegendBoxProps> = ({
  min,
  mid,
  max,
  colorScale,
  isMobile = false,
}) => {
  const legendHeight = isMobile ? 120 : 180;
  const legendWidth = isMobile ? 20 : 28;
  const steps = isMobile ? 30 : 40;
  const values = d3
    .range(min, max, (max - min) / steps)
    .concat([max])
    .reverse();

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        padding: isMobile ? 8 : 16,
        display: "block",
        textAlign: "center",
        width: "100%",
        maxWidth: isMobile ? 120 : 200,
        border: "1px solid #000",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: isMobile ? 4 : 8,
          fontSize: isMobile ? 12 : 16,
        }}
      >
        Legend
      </div>
      <svg
        width={legendWidth + (isMobile ? 30 : 40)}
        height={legendHeight + 10}
      >
        {/* Color bar (inverted) */}
        {values.map((v, i) => (
          <rect
            key={i}
            x={0}
            y={(legendHeight * i) / steps}
            width={legendWidth}
            height={legendHeight / steps + 1}
            fill={colorScale(v)}
            stroke="#000"
            strokeWidth="0.5"
          />
        ))}
        {/* Axis labels (inverted) */}
        <text
          x={legendWidth + 8}
          y={10}
          fontSize={isMobile ? 8 : 12}
          fill="#444"
        >
          Max: {Math.round(max).toString()}
        </text>
        <text
          x={legendWidth + 8}
          y={legendHeight / 2 + 5}
          fontSize={isMobile ? 8 : 12}
          fill="#444"
        >
          {isMobile ? "Mid:" : "Median:"} {Math.round(mid).toString()}
        </text>
        <text
          x={legendWidth + 8}
          y={legendHeight}
          fontSize={isMobile ? 8 : 12}
          fill="#444"
        >
          Min: {Math.round(min).toString()}
        </text>
      </svg>
    </div>
  );
};
