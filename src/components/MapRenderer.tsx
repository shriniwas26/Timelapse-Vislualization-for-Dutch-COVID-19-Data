import { Box, useMediaQuery, useTheme } from "@mui/material";
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

  // Responsive design
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));

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

    // Create tooltip div with mobile-friendly styling
    d3.select("body")
      .append("div")
      .attr("class", "covid-tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.9)")
      .style("color", "white")
      .style("padding", isMobile ? "10px 14px" : "8px 12px")
      .style("border-radius", "8px")
      .style("font-size", isMobile ? "14px" : "12px")
      .style("font-family", "Arial, sans-serif")
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("opacity", "0")
      .style("transition", "opacity 0.2s")
      .style("white-space", "nowrap")
      .style("box-shadow", "0 4px 12px rgba(0,0,0,0.4)")
      .style("max-width", isMobile ? "200px" : "150px")
      .style("line-height", "1.4");

    console.log("Tooltip created");

    // Cleanup function
    return () => {
      d3.selectAll(".covid-tooltip").remove();
    };
  }, [isMobile]); // Recreate tooltip when mobile state changes

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

    // Center the map initially or apply preserved transform
    const g = svg.append("g");

    // Add zoom behavior with mobile-friendly settings
    const zoom = d3
      .zoom()
      .scaleExtent(isMobile ? [0.3, 6] : [0.5, 8]) // More restrictive zoom for mobile
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setCurrentTransform(event.transform);
      });

    svg.call(zoom as any);
    const defaultTransform = d3.zoomIdentity
      .translate(-width * 0.05, height * 0.05)
      .scale(isMobile ? 0.8 : 0.85); // Slightly smaller default scale for mobile
    // Apply initial transform using D3's zoom transform method
    if (isInitialRender.current) {
      // First render - apply default transform
      svg.call(zoom.transform as any, defaultTransform);
      setCurrentTransform(defaultTransform);
      isInitialRender.current = false;
    } else if (currentTransform) {
      // Subsequent renders - apply preserved transform
      console.log(
        "Subsequent renders - apply preserved transform",
        currentTransform
      );
      svg.call(zoom.transform as any, currentTransform);
    } else {
      // Fallback - apply default transform
      svg.call(zoom.transform as any, defaultTransform);
      setCurrentTransform(defaultTransform);
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
      .attr("stroke-width", isMobile ? 0.5 : 1) // Thinner strokes for mobile
      .attr("opacity", 0.7)
      .on("mouseover", function (event, d: any) {
        const areaCode = d.properties?.areaCode;
        if (!areaCode) return;

        const municipalityCode = areaCodeToGmCode(areaCode);
        const covidValue = currentDayData.data[municipalityCode] || 0;
        const areaName = d.properties?.areaName || "Unknown";

        // Highlight on hover
        d3.select(this)
          .attr("stroke-width", isMobile ? 2 : 3)
          .attr("stroke", "#333")
          .attr("opacity", 0.9);

        // Show tooltip with mobile-friendly positioning
        const tooltip = d3.select(".covid-tooltip");
        if (!tooltip.empty()) {
          const tooltipContent = isMobile
            ? `<strong>${areaName}</strong><br/>Cases per 100k: ${covidValue.toFixed(
                1
              )}`
            : `<strong>${areaName}</strong><br/>Cases per 100k: ${covidValue.toFixed(
                1
              )}`;

          tooltip
            .html(tooltipContent)
            .style("left", () => {
              // Mobile-friendly positioning
              const tooltipWidth = isMobile ? 200 : 150;
              const pageX = event.pageX;
              const windowWidth = window.innerWidth;

              // Prevent tooltip from going off-screen
              if (pageX + tooltipWidth + 20 > windowWidth) {
                return pageX - tooltipWidth - 10 + "px";
              }
              return pageX + 10 + "px";
            })
            .style("top", () => {
              // Mobile-friendly vertical positioning
              const pageY = event.pageY;
              const windowHeight = window.innerHeight;
              const tooltipHeight = isMobile ? 60 : 50;

              // Prevent tooltip from going off-screen
              if (pageY + tooltipHeight + 20 > windowHeight) {
                return pageY - tooltipHeight - 10 + "px";
              }
              return pageY - 10 + "px";
            })
            .style("opacity", "1");
        } else {
          console.log("Tooltip not found!");
        }
      })
      .on("mousemove", function (event) {
        // Update tooltip position on mouse move with mobile-friendly positioning
        const tooltip = d3.select(".covid-tooltip");
        if (!tooltip.empty()) {
          const tooltipWidth = isMobile ? 200 : 150;
          const pageX = event.pageX;
          const windowWidth = window.innerWidth;
          const pageY = event.pageY;
          const windowHeight = window.innerHeight;
          const tooltipHeight = isMobile ? 60 : 50;

          // Prevent tooltip from going off-screen
          const left =
            pageX + tooltipWidth + 20 > windowWidth
              ? pageX - tooltipWidth - 10
              : pageX + 10;
          const top =
            pageY + tooltipHeight + 20 > windowHeight
              ? pageY - tooltipHeight - 10
              : pageY - 10;

          tooltip.style("left", left + "px").style("top", top + "px");
        }
      })
      .on("mouseout", function () {
        d3.select(this)
          .attr("stroke-width", isMobile ? 0.5 : 1)
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
    isMobile,
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

  console.debug("MapRenderer: Rendering D3 map");
  console.debug("MapRenderer: isDataLoaded:", isDataLoaded);
  console.debug("MapRenderer: nlGeoJson:", !!nlGeoJson);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: "#f8f9fa",
        // Mobile touch improvements
        touchAction: "manipulation",
        userSelect: "none",
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
