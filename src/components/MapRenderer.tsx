import { Box } from "@mui/material";
import * as d3 from "d3";
import _ from "lodash";
import { useCallback, useEffect, useRef } from "react";
import { DayData, GeoJson } from "../types";

const ANIMATION_DELAY = 50;

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
  const resizeMapThrottledRef = useRef<_.DebouncedFunc<() => void> | null>(
    null
  );

  // Use refs to avoid dependency issues
  const colorScaleRef = useRef<d3.ScaleLinear<number, string> | null>(null);
  const covidDataRef = useRef<DayData[] | null>(null);
  const isDataLoadedRef = useRef<boolean>(false);
  const nlGeoJsonRef = useRef<GeoJson | null>(null);

  // Update refs when props change
  useEffect(() => {
    colorScaleRef.current = colorScale;
  }, [colorScale]);

  useEffect(() => {
    covidDataRef.current = covidDataGroupedByDay;
  }, [covidDataGroupedByDay]);

  useEffect(() => {
    isDataLoadedRef.current = isDataLoaded;
  }, [isDataLoaded]);

  useEffect(() => {
    nlGeoJsonRef.current = nlGeoJson;
  }, [nlGeoJson]);

  useEffect(() => {
    // Cleanup tooltip div on unmount or when data is not loaded
    return () => {
      d3.select(".map-container").selectAll(".d3-tooltip").remove();
    };
  }, [isDataLoaded]);

  const initialMapRender = useCallback(() => {
    if (!nlGeoJsonRef.current || !colorScaleRef.current) return;

    const nlGeoJson = nlGeoJsonRef.current;
    const colorScale = colorScaleRef.current;

    // Get the actual domain values from the colorScale
    const domain = colorScale.domain();
    const medVal = domain[1] || 0;
    const maxVal = domain[2] || 0;
    const svg = d3.select("#svg-nl-map");
    svg.empty();

    // Draw the map
    const mapContainer = d3.select(".map-container").node() as HTMLElement;
    const containerRect = mapContainer.getBoundingClientRect();

    // Use container dimensions instead of window dimensions
    const mapWidth = containerRect.width * 0.75;
    const mapHeight = containerRect.height * 0.75;

    const projection = d3
      .geoMercator()
      .fitSize([mapWidth, mapHeight], nlGeoJson as any);

    // Set SVG dimensions to match container
    svg.attr("width", mapWidth).attr("height", mapHeight);

    svg
      .append("g")
      .attr("id", "path-group")
      .classed("nl-map", true)
      .selectAll("path")
      .data(nlGeoJson.features)
      .enter()
      .append("path")
      .attr("stroke", "black")
      .attr("stroke-width", 1.0)
      .attr("fill", "white") // Set initial fill color
      // draw each Municipality
      .attr("d", (d: any) => d3.geoPath().projection(projection)(d as any))
      .attr("id", (d) => areaCodeToGmCode(d.properties.areaCode))
      .on("mouseover", (e, d) => {
        d3.select(e.target as Element).attr("stroke-width", 4.0);

        const tooltip = (window as any).mapTooltip;
        if (tooltip) {
          tooltip
            .style("visibility", "visible")
            .text(`Municipality: ${d.properties.areaName}`);
        }
      })
      .on("mousemove", (e, _d) => {
        const mapContainer = d3.select(".map-container").node() as HTMLElement;
        if (!mapContainer) {
          console.log("Map container not found");
          return;
        }

        const tooltip = (window as any).mapTooltip;
        if (!tooltip) return;

        const containerRect = mapContainer.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;

        // Get actual tooltip dimensions
        const tooltipNode = tooltip.node() as HTMLElement;
        const tooltipRect = tooltipNode.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width;
        const tooltipHeight = tooltipRect.height;

        // Ensure tooltip stays within map bounds
        const maxX = containerRect.width - tooltipWidth - 10;
        const maxY = containerRect.height - tooltipHeight - 10;

        // Position tooltip to the right and slightly below the mouse cursor
        let left = mouseX + 10;
        let top = mouseY + 10;

        // Adjust if tooltip would go outside bounds
        if (left + tooltipWidth > containerRect.width - 10) {
          left = mouseX - tooltipWidth - 10;
        }
        if (top + tooltipHeight > containerRect.height - 10) {
          top = mouseY - tooltipHeight - 10;
        }

        // Ensure minimum position
        left = Math.max(10, Math.min(left, maxX));
        top = Math.max(10, Math.min(top, maxY));

        tooltip.style("top", top + "px").style("left", left + "px");
      })
      .on("mouseout", (e) => {
        const tooltip = (window as any).mapTooltip;
        if (tooltip) {
          tooltip.style("visibility", "hidden");
        }
        d3.select(e.target as Element).attr("stroke-width", 1.0);
      });
  }, []);

  const resizeMap = useCallback(() => {
    if (!nlGeoJson) return;

    const mapContainer = d3.select(".map-container").node() as HTMLElement;
    if (!mapContainer) return;

    const containerRect = mapContainer.getBoundingClientRect();
    const mapWidth = containerRect.width;
    const mapHeight = containerRect.height;

    const projection = d3
      .geoMercator()
      .fitSize([mapWidth, mapHeight], nlGeoJson as any);

    d3.select("#svg-nl-map")
      .selectAll(".nl-map path")
      .transition()
      .duration(0)
      .attr("d", d3.geoPath().projection(projection));
  }, [nlGeoJson]);

  const redrawDay = useCallback(
    (dayIdx: number) => {
      if (
        !isDataLoadedRef.current ||
        !colorScaleRef.current ||
        !covidDataRef.current
      ) {
        return;
      }

      const dailyDict = covidDataRef.current[dayIdx].data;

      d3.select("#svg-nl-map")
        .selectAll("#path-group path")
        .transition()
        .duration(ANIMATION_DELAY)
        .ease(d3.easePoly)
        .attr("fill", (e: any) => {
          const municipalityCode = areaCodeToGmCode(e.properties.areaCode);
          const currentReported = dailyDict[municipalityCode];

          if (currentReported === undefined) {
            return "rgb(170, 170, 170)";
          }

          if (currentReported === null) {
            return "rgb(255, 255, 255)";
          }

          const color = colorScaleRef.current(currentReported);
          return color;
        });
    },
    [] // No dependencies since we use refs
  );

  // Initialize throttled resize function
  useEffect(() => {
    resizeMapThrottledRef.current = _.throttle(resizeMap, 1000, {
      leading: false,
      trailing: true,
    });
  }, [resizeMap]);

  // Initial render effect - only runs once when data is loaded
  useEffect(() => {
    if (isDataLoaded && nlGeoJson && covidDataGroupedByDay && colorScale) {
      // Initial map render
      initialMapRender();

      // Set up resize listener
      if (resizeMapThrottledRef.current) {
        window.removeEventListener("resize", resizeMapThrottledRef.current);
        window.addEventListener("resize", resizeMapThrottledRef.current);
      }

      // Render first day
      redrawDay(0);
    }
  }, [isDataLoaded, nlGeoJson, covidDataGroupedByDay, colorScale]);

  // Redraw effect - runs when selectedDayIdx changes
  useEffect(() => {
    if (
      isDataLoaded &&
      selectedDayIdx >= 0 &&
      colorScaleRef.current &&
      covidDataRef.current
    ) {
      redrawDay(selectedDayIdx);
    }
  }, [selectedDayIdx, isDataLoaded]);

  // Create tooltip when component mounts
  useEffect(() => {
    if (!isDataLoaded) return;

    // Remove any existing tooltip divs
    d3.select(".map-container").selectAll(".d3-tooltip").remove();

    const mapContainer = d3.select(".map-container");
    if (mapContainer.empty()) {
      console.log("Map container not found during tooltip creation");
      return;
    }

    const toolDiv = d3
      .select(".map-container")
      .append("div")
      .attr("class", "d3-tooltip")
      .style("visibility", "hidden")
      .style("position", "absolute")
      .style("background-color", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("font", "11px Arial, sans-serif")
      .style("border-radius", "4px")
      .style("box-sizing", "border-box")
      .style("padding", "6px 8px")
      .style("z-index", "1000")
      .style("pointer-events", "none")
      .style("border", "none")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.3)")
      .style("white-space", "nowrap")
      .style("max-width", "200px");

    // Store tooltip reference for use in event handlers
    (window as any).mapTooltip = toolDiv;

    return () => {
      d3.select(".map-container").selectAll(".d3-tooltip").remove();
    };
  }, [isDataLoaded]);

  // Cleanup resize listener
  useEffect(() => {
    return () => {
      if (resizeMapThrottledRef.current) {
        window.removeEventListener("resize", resizeMapThrottledRef.current);
      }
    };
  }, []);

  if (!isDataLoaded) {
    return null;
  }

  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <div className="map-container">
        <svg id="svg-nl-map" />
      </div>
    </Box>
  );
}
