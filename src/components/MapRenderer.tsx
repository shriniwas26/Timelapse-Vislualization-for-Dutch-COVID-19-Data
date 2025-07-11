import { Box } from "@mui/material";
import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";
import { DayData, GeoJson } from "../types";

const areaCodeToGmCode = (x: number): string => {
  return "GM" + x.toString().padStart(4, "0");
};

interface MapRendererProps {
  nlGeoJson: GeoJson;
  covidDataGroupedByDay: DayData[];
  colorScale: d3.ScaleLinear<number, string>;
  selectedDayIdx: number;
  isDataLoaded: boolean;
}

export function MapRenderer({
  nlGeoJson,
  covidDataGroupedByDay,
  colorScale,
  selectedDayIdx,
  isDataLoaded,
}: MapRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapKey, setMapKey] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Preserve zoom/pan state across re-renders
  const [currentTransform, setCurrentTransform] =
    useState<d3.ZoomTransform | null>(null);
  const isInitialRender = useRef(true);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    // Initial dimensions
    updateDimensions();

    // Set up resize observer
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Create tooltip once and reuse
  useEffect(() => {
    // Remove any existing tooltip
    d3.selectAll(".covid-tooltip").remove();

    // Create tooltip div
    d3.select("body")
      .append("div")
      .attr("class", "covid-tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "8px 12px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("font-family", "Arial, sans-serif")
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("opacity", "0")
      .style("transition", "opacity 0.2s")
      .style("white-space", "nowrap")
      .style("box-shadow", "0 4px 8px rgba(0,0,0,0.3)");

    console.log("Tooltip created");

    // Cleanup function
    return () => {
      d3.selectAll(".covid-tooltip").remove();
    };
  }, []); // Only run once on mount

  // Force map re-render when data is loaded or dimensions change
  useEffect(() => {
    if (isDataLoaded || dimensions.width > 0) {
      setMapKey((prev) => prev + 1);
    }
  }, [isDataLoaded, dimensions]);

  // D3 map rendering
  useEffect(() => {
    if (
      !svgRef.current ||
      !nlGeoJson ||
      !covidDataGroupedByDay ||
      selectedDayIdx >= covidDataGroupedByDay.length ||
      dimensions.width === 0
    ) {
      return;
    }

    const currentDayData = covidDataGroupedByDay[selectedDayIdx];
    console.log("D3: Rendering map for day", selectedDayIdx);

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const width = dimensions.width;
    const height = dimensions.height;

    // Create projection for Netherlands with padding
    const projection = d3
      .geoMercator()
      .fitSize([width * 0.9, height * 0.9], nlGeoJson as any) // Add 10% padding
      .precision(100);

    // Create path generator
    const path = d3.geoPath().projection(projection);

    // Create SVG container
    const svg = d3.select(svgRef.current);

    // Add zoom behavior with better bounds
    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 8]) // Allow zooming out more
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setCurrentTransform(event.transform);
      });

    svg.call(zoom as any);

    // Center the map initially or apply preserved transform
    const g = svg.append("g");

    if (isInitialRender.current) {
      // First render - center with padding
      g.attr("transform", `translate(${width * 0.05}, ${height * 0.05})`);
      isInitialRender.current = false;
    } else if (currentTransform) {
      // Subsequent renders - apply preserved transform
      g.attr("transform", currentTransform.toString());
    } else {
      // Fallback - center with padding
      g.attr("transform", `translate(${width * 0.05}, ${height * 0.05})`);
    }

    // Render municipalities
    g.selectAll("path")
      .data(nlGeoJson.features)
      .enter()
      .append("path")
      .attr("d", path as any)
      .attr("fill", (d: any) => {
        const areaCode = d.properties?.areaCode;
        if (!areaCode) return "#ffffff";

        const municipalityCode = areaCodeToGmCode(areaCode);
        const covidValue = currentDayData.data[municipalityCode] || 0;
        return colorScale(covidValue);
      })
      .attr("stroke", "black")
      .attr("stroke-width", 1)
      .attr("opacity", 0.7)
      .on("mouseover", function (event, d: any) {
        const areaCode = d.properties?.areaCode;
        if (!areaCode) return;

        const municipalityCode = areaCodeToGmCode(areaCode);
        const covidValue = currentDayData.data[municipalityCode] || 0;
        const areaName = d.properties?.areaName || "Unknown";

        console.log("Mouseover:", areaName, covidValue);

        // Highlight on hover
        d3.select(this)
          .attr("stroke-width", 3)
          .attr("stroke", "#333")
          .attr("opacity", 0.9);

        // Show tooltip
        const tooltip = d3.select(".covid-tooltip");
        if (!tooltip.empty()) {
          tooltip
            .html(
              `<strong>${areaName}</strong><br/>Cases per 100k: ${covidValue.toFixed(
                1
              )}`
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px")
            .style("opacity", "1");
        } else {
          console.log("Tooltip not found!");
        }
      })
      .on("mousemove", function (event) {
        // Update tooltip position on mouse move
        const tooltip = d3.select(".covid-tooltip");
        if (!tooltip.empty()) {
          tooltip
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 10 + "px");
        }
      })
      .on("mouseout", function () {
        d3.select(this)
          .attr("stroke-width", 1)
          .attr("stroke", "black")
          .attr("opacity", 0.7);

        const tooltip = d3.select(".covid-tooltip");
        if (!tooltip.empty()) {
          tooltip.style("opacity", "0");
        }
      });
  }, [
    nlGeoJson,
    covidDataGroupedByDay,
    colorScale,
    selectedDayIdx,
    mapKey,
    dimensions,
  ]);

  if (!isDataLoaded || !nlGeoJson) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f5f5",
        }}
      >
        <div>Loading map...</div>
      </Box>
    );
  }

  console.log("MapRenderer: Rendering D3 map");
  console.log("MapRenderer: isDataLoaded:", isDataLoaded);
  console.log("MapRenderer: nlGeoJson:", !!nlGeoJson);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: "#f8f9fa",
      }}
    >
      <svg
        key={mapKey}
        ref={svgRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </Box>
  );
}
