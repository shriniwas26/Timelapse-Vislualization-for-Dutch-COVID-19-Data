import * as d3 from "d3";
import Moment from "moment";
import { useEffect, useRef, useState } from "react";
import {
  CovidDataPoint,
  DayData,
  GeoJson,
  PopulationDataPoint,
} from "../types";

const PER_POPULATION = 100_000;
const REPORTED_FIELD = "Total_reported";
const DAILY_REPORTED_FIELD = "Daily_" + REPORTED_FIELD;
const DAILY_REPORTED_FIELD_MA = "Daily_" + REPORTED_FIELD + "_ma";
const MOVING_AVG_WINDOW = 14;

const movingAvg = (inputArr: number[], maWin: number): number[] => {
  const tempArr = Array(inputArr.length);
  for (let i = 0; i < inputArr.length; i++) {
    tempArr[i] = 0;
    let n = 0;
    for (let j = 0; j < maWin; j++) {
      if (i + j < inputArr.length) {
        n++;
        tempArr[i] = tempArr[i] + inputArr[i + j];
      }
    }
    tempArr[i] = tempArr[i] / n;
  }
  return tempArr;
};

import { LoadedData } from "../types";

interface DataLoaderProps {
  onDataLoaded: (data: LoadedData) => void;
}

export function DataLoader({ onDataLoaded }: DataLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const onDataLoadedRef = useRef(onDataLoaded);

  // Update ref when callback changes
  useEffect(() => {
    onDataLoadedRef.current = onDataLoaded;
  }, [onDataLoaded]);

  const getTickMarks = (covidDataGroupedByDay: DayData[]) => {
    const tickMarks: Array<{ value: number; label: string }> = [];
    covidDataGroupedByDay.forEach((element, idx) => {
      const isTick =
        element.date.dayOfYear() === 1 ||
        (window.innerWidth >= 550 && element.date.dayOfYear() === 181);
      if (isTick) {
        tickMarks.push({
          value: idx,
          label: element.date.format("MMM YYYY"),
        });
      }
    });
    return tickMarks;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const urls = [
          "data/nl-compact.json",
          "data/NL_Population_Latest.csv",
          "data/COVID-19_aantallen_gemeente_cumulatief_min.csv",
        ];

        const [nlGeoJsonText, populationDataText, covidDataText] =
          await Promise.all(
            urls.map((url) => fetch(url).then((response) => response.text()))
          );

        const nlGeoJson: GeoJson = JSON.parse(nlGeoJsonText);
        const covidData: CovidDataPoint[] = d3.csvParse(
          covidDataText,
          d3.autoType
        ) as CovidDataPoint[];
        const populationData: PopulationDataPoint[] = d3.csvParse(
          populationDataText,
          d3.autoType
        ) as PopulationDataPoint[];

        const populationDataDict = Object.fromEntries(
          populationData.map((elem) => {
            return [elem["Regions"], elem["PopulationOn31December_20"]];
          })
        );

        console.log("Population data sample:", populationData.slice(0, 5));
        console.log(
          "Population data dict sample:",
          Object.entries(populationDataDict).slice(0, 5)
        );
        console.log(
          "COVID data municipality codes sample:",
          [...new Set(covidData.map((d) => d["Municipality_code"]))].slice(
            0,
            10
          )
        );

        /** Calculate daily values */
        const covidDataGroupedByMunicipality = d3.group(
          covidData,
          (x) => x["Municipality_code"]
        );

        covidDataGroupedByMunicipality.forEach((munData) => {
          munData.sort((a, b) =>
            a["Date_of_report"] > b["Date_of_report"] ? 1 : -1
          );

          munData[0][DAILY_REPORTED_FIELD] = munData[0][REPORTED_FIELD];
          for (let i = 1; i < munData.length; i++) {
            munData[i][DAILY_REPORTED_FIELD] =
              munData[i][REPORTED_FIELD] - munData[i - 1][REPORTED_FIELD];
          }
          // Compute moving average
          const movingAvgArr = movingAvg(
            munData.map((d) => d[DAILY_REPORTED_FIELD]),
            MOVING_AVG_WINDOW
          );
          for (let i = 0; i < munData.length; i++) {
            munData[i][DAILY_REPORTED_FIELD_MA] = movingAvgArr[i];
          }
        });

        const covidDataDiffed = Array.from(covidDataGroupedByMunicipality)
          .map((x) => x[1])
          .flat();

        const populationAdjustedCovidData = covidDataDiffed.map((elem) => {
          const rowData: any = {};
          rowData["Date_of_report"] = Moment(elem["Date_of_report"]).format(
            "YYYY-MM-DD"
          );
          rowData["Municipality_code"] = elem["Municipality_code"];
          rowData[DAILY_REPORTED_FIELD_MA] = Math.round(
            (elem[DAILY_REPORTED_FIELD_MA] /
              populationDataDict[elem["Municipality_code"]]) *
              PER_POPULATION
          );
          return rowData;
        });

        const maxVal =
          100 *
          Math.ceil(
            (1 / 100) *
              d3.max(
                populationAdjustedCovidData.map(
                  (e) => e[DAILY_REPORTED_FIELD_MA]
                )
              )
          );
        const medVal = d3.mean(
          populationAdjustedCovidData.map((e) => e[DAILY_REPORTED_FIELD_MA])
        );

        const covidDataGroupedByDay: DayData[] = Array.from(
          d3.group(populationAdjustedCovidData, (x) => x["Date_of_report"]),
          ([date, data]) => {
            return {
              date: Moment(date, "YYYY-MM-DD"),
              data: Object.fromEntries(
                data.map((e) => [
                  e["Municipality_code"],
                  e[DAILY_REPORTED_FIELD_MA],
                ])
              ),
            };
          }
        );
        covidDataGroupedByDay.sort((x, y) => (x.date > y.date ? 1 : -1));

        const colorScale = d3
          .scaleLinear<number, string>()
          .domain([0, medVal || 0, maxVal || 0])
          .range(["white", "orange", "red"] as any);

        console.log("Color scale created:", !!colorScale);
        console.log("Color scale domain:", [0, medVal, maxVal]);
        console.log("Color scale range:", ["white", "orange", "red"]);
        console.log("Max value:", maxVal, "Med value:", medVal);

        const sliderMarks = getTickMarks(covidDataGroupedByDay);

        onDataLoadedRef.current({
          nlGeoJson,
          covidDataGroupedByDay,
          colorScale,
          numberOfDays: covidDataGroupedByDay.length,
          sliderMarks,
        });

        setIsLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setIsLoading(false);
      }
    };

    loadData();
  }, []); // Only run once on mount

  if (isLoading) {
    return (
      <div
        style={{
          height: "90%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div>Loading data...</div>
      </div>
    );
  }

  return null;
}
