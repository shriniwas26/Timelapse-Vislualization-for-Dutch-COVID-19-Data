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
  console.log("%c[LegendBox]", "color: red; font-size: 16px;", {
    min,
    mid,
    max,
    colorScaleDomain: colorScale.domain(),
  });
  const legendHeight = 180;
  const legendWidth = 28;
  const steps = 40;
  const values = d3.range(min, max, (max - min) / steps).concat([max]);

  return (
    <div
      style={{
        background: "#fff",
        border: "2px solid red", // for debugging
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        padding: 18,
        display: "block",
        margin: "24px auto",
        maxWidth: 200,
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 16 }}>
        Legend
      </div>
      <svg width={legendWidth + 40} height={legendHeight + 10}>
        {/* Color bar */}
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
        {/* Axis labels */}
        <text x={legendWidth + 8} y={10} fontSize={12} fill="#444">
          {max.toLocaleString()}
        </text>
        <text
          x={legendWidth + 8}
          y={legendHeight / 2 + 5}
          fontSize={12}
          fill="#444"
        >
          {mid.toLocaleString()}
        </text>
        <text x={legendWidth + 8} y={legendHeight} fontSize={12} fill="#444">
          {min.toLocaleString()}
        </text>
      </svg>
    </div>
  );
};
