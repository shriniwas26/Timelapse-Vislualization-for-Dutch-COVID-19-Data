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

    const legendSvgGroup = svg.append("g").classed("legend-group", true);

    const [legendWidth, legendHeight] = [
      0.04 * window.innerWidth,
      0.25 * window.innerHeight,
    ];

    // Create legend using pure D3
    const legendStep = (100 * medVal) / legendHeight;
    const expandedDomain = [
      ...d3.range(0, medVal, legendStep),
      ...d3.range(medVal, maxVal + legendStep, legendStep),
    ];

    // Create legend rectangles
    const legendBar = legendSvgGroup
      .append("g")
      .selectAll("rect")
      .data(expandedDomain)
      .enter()
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendStep)
      .attr("y", (d, i) => i * legendStep)
      .style("fill", (d) => colorScale(d));

    // Create axis for legend
    const yScale = d3
      .scaleLinear()
      .domain([maxVal, 0])
      .range([0, legendHeight]);

    const axisLabel = d3.axisRight(yScale).tickValues([0, medVal, maxVal]);

    // Add the axis
    const barWidth = Math.abs(
      legendBar.node()?.getBoundingClientRect().width || 0
    );
    legendSvgGroup
      .append("g")
      .attr("transform", `translate(${barWidth + 10},0)`)
      .call(axisLabel);

    legendSvgGroup.attr(
      "transform",
      `translate(${0.02 * window.innerWidth}, 20)`
    );

    const toolDiv = d3
      .select("#chartArea")
      .append("div")
      .style("visibility", "hidden")
      .style("position", "absolute")
      .style("background-color", "skyblue")
      .style("font", "14px times")
      .style("border-radius", "10px")
      .style("box-sizing", "border-box")
      .style("padding", "10px");

    // Draw the map
    const projection = d3
      .geoMercator()
      .fitSize(
        [window.innerWidth / 2, window.innerHeight / 2],
        nlGeoJson as any
      );

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

        toolDiv
          .style("visibility", "visible")
          .text(`Municipality: ${d.properties.areaName}`);
      })
      .on("mousemove", (e, _d) => {
        toolDiv
          .style("top", e.pageY - 50 + "px")
          .style("left", e.pageX - 50 + "px");
      })
      .on("mouseout", (e) => {
        toolDiv.style("visibility", "hidden");
        d3.select(e.target as Element).attr("stroke-width", 1.0);
      });
  }, []);

  const resizeMap = useCallback(() => {
    if (!nlGeoJson) return;

    console.debug(
      `Resizing map to ${window.innerWidth} x ${window.innerHeight} screen-size`
    );
    const projection = d3
      .geoMercator()
      .fitSize(
        [window.innerWidth / 2, window.innerHeight / 2],
        nlGeoJson as any
      );

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

  // Cleanup resize listener
  useEffect(() => {
    return () => {
      if (resizeMapThrottledRef.current) {
        window.removeEventListener("resize", resizeMapThrottledRef.current);
      }
    };
  }, []);

  return <svg id="svg-nl-map" className="m-1 w-75 col-12" height="60vh"></svg>;
}
