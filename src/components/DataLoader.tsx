import {
  Box,
  LinearProgress,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
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

interface LoadingProgress {
  currentStep: number;
  totalSteps: number;
  currentFile: string;
  overallProgress: number;
  fileSize?: string;
  downloadSpeed?: string;
  fileProgress: {
    map: number;
    population: number;
    covid: number;
  };
}

export function DataLoader({ onDataLoaded }: DataLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    currentStep: 0,
    totalSteps: 3, // Only 3 file downloads
    currentFile: "Initializing...",
    overallProgress: 0,
    fileSize: "",
    downloadSpeed: "",
    fileProgress: {
      map: 0,
      population: 0,
      covid: 0,
    },
  });

  // Responsive design
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const onDataLoadedRef = useRef(onDataLoaded);

  // Update ref when callback changes
  useEffect(() => {
    onDataLoadedRef.current = onDataLoaded;
  }, [onDataLoaded]);

  const updateProgress = (
    step: number,
    file: string,
    progress: number,
    fileSize?: string,
    downloadSpeed?: string,
    fileType?: "map" | "population" | "covid"
  ) => {
    // Calculate smoother overall progress for 3 steps only
    const stepProgress = (step - 1) / 3; // Progress from completed steps
    const currentStepProgress = progress / 100; // Progress within current step
    const overallProgress = (stepProgress + currentStepProgress / 3) * 100;

    // Update individual file progress - maintain completed files at 100%
    const currentFileProgress = {
      map: loadingProgress.fileProgress.map,
      population: loadingProgress.fileProgress.population,
      covid: loadingProgress.fileProgress.covid,
    };

    if (fileType) {
      // Update only the current file's progress
      currentFileProgress[fileType] = progress;

      // Ensure completed files stay at 100%
      if (step >= 2 && fileType !== "map") {
        currentFileProgress.map = 100;
      }
      if (step >= 3 && fileType !== "population") {
        currentFileProgress.population = 100;
      }
    }

    setLoadingProgress({
      currentStep: step,
      totalSteps: 3,
      currentFile: file,
      overallProgress: Math.min(overallProgress, 100), // Ensure we don't exceed 100%
      fileSize,
      downloadSpeed,
      fileProgress: currentFileProgress,
    });
  };

  const downloadWithProgress = async (
    url: string,
    fileName: string,
    fileType: "map" | "population" | "covid"
  ): Promise<string> => {
    const startTime = Date.now();
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${fileName}`);
    }

    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedLength = 0;
    let result = "";
    let fileSizeText = "";
    let speedText = "";
    let lastUpdateTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      receivedLength += value.length;
      result += decoder.decode(value, { stream: true });

      // Update progress more frequently (every 100ms or when progress changes significantly)
      const currentTime = Date.now();
      const timeSinceLastUpdate = currentTime - lastUpdateTime;
      const progressChange = total > 0 ? (receivedLength / total) * 100 : 50;

      if (timeSinceLastUpdate > 100 || progressChange > 5) {
        // Update every 100ms or 5% change
        // Calculate download speed and file size
        const elapsedTime = (currentTime - startTime) / 1000; // seconds
        const speed = elapsedTime > 0 ? receivedLength / elapsedTime : 0;
        speedText =
          speed > 1024 * 1024
            ? `${(speed / (1024 * 1024)).toFixed(1)} MB/s`
            : speed > 1024
            ? `${(speed / 1024).toFixed(1)} KB/s`
            : `${Math.round(speed)} B/s`;

        fileSizeText =
          total > 0
            ? `${(receivedLength / 1024).toFixed(1)} / ${(total / 1024).toFixed(
                1
              )} KB`
            : `${(receivedLength / 1024).toFixed(1)} KB`;

        // Update progress based on actual bytes received
        if (total > 0) {
          const fileProgress = (receivedLength / total) * 100;
          updateProgress(
            fileType === "map" ? 1 : fileType === "population" ? 2 : 3,
            `Downloading ${fileName}...`,
            fileProgress,
            fileSizeText,
            speedText,
            fileType
          );
        } else {
          // If we can't get content length, simulate smooth progress
          const simulatedProgress = Math.min(50 + receivedLength / 1024, 95); // Cap at 95% until complete
          updateProgress(
            fileType === "map" ? 1 : fileType === "population" ? 2 : 3,
            `Downloading ${fileName}...`,
            simulatedProgress,
            fileSizeText,
            speedText,
            fileType
          );
        }

        lastUpdateTime = currentTime;
      }
    }

    // Final update
    fileSizeText =
      total > 0
        ? `${(total / 1024).toFixed(1)} KB`
        : `${(receivedLength / 1024).toFixed(1)} KB`;

    const finalElapsedTime = (Date.now() - startTime) / 1000;
    const finalSpeed =
      finalElapsedTime > 0 ? receivedLength / finalElapsedTime : 0;
    speedText =
      finalSpeed > 1024 * 1024
        ? `${(finalSpeed / (1024 * 1024)).toFixed(1)} MB/s`
        : finalSpeed > 1024
        ? `${(finalSpeed / 1024).toFixed(1)} KB/s`
        : `${Math.round(finalSpeed)} B/s`;

    updateProgress(
      fileType === "map" ? 1 : fileType === "population" ? 2 : 3,
      `Downloading ${fileName}...`,
      100,
      fileSizeText,
      speedText,
      fileType
    );
    return result;
  };

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
        updateProgress(1, "Loading map data...", 0);

        const urls = [
          "data/nl-compact.json",
          "data/NL_Population_Latest.csv",
          "data/COVID-19_aantallen_gemeente_cumulatief_min.csv",
        ];

        const fileNames = [
          "Map Data",
          "NL Population Data",
          "COVID-19 Daily Data",
        ];

        // Load files with progress tracking - each file is a separate step
        const fileResults = [];
        for (let i = 0; i < urls.length; i++) {
          const fileType = i === 0 ? "map" : i === 1 ? "population" : "covid";

          // Update current step and start downloading
          updateProgress(
            i + 1,
            `Downloading ${fileNames[i]}...`,
            0,
            "",
            "",
            fileType
          );
          const text = await downloadWithProgress(
            urls[i],
            fileNames[i],
            fileType
          );
          fileResults.push({ url: urls[i], text, fileName: fileNames[i] });

          // Set current file to 100% when completed
          updateProgress(
            i + 1,
            `Downloading ${fileNames[i]}...`,
            100,
            "",
            "",
            fileType
          );
        }

        // Process all data without progress updates
        const nlGeoJson: GeoJson = JSON.parse(fileResults[0].text);
        const covidData: CovidDataPoint[] = d3.csvParse(
          fileResults[2].text,
          d3.autoType
        ) as CovidDataPoint[];

        const populationData: PopulationDataPoint[] = d3.csvParse(
          fileResults[1].text,
          d3.autoType
        ) as PopulationDataPoint[];

        const populationDataDict = Object.fromEntries(
          populationData.map((elem) => {
            return [elem["Regions"], elem["PopulationOn31December_20"]];
          })
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

        console.log("Color scale domain:", [0, medVal, maxVal]);
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
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: isMobile ? 2 : 3,
          padding: isMobile ? 2 : 3,
        }}
      >
        <Box
          sx={{
            textAlign: "center",
            maxWidth: isMobile ? 300 : 400,
            width: "100%",
          }}
        >
          <Typography
            variant={isMobile ? "h6" : "h5"}
            sx={{
              marginBottom: isMobile ? 1.5 : 2,
              color: "#2c3e50",
              fontSize: isSmallMobile
                ? "1.1rem"
                : isMobile
                ? "1.25rem"
                : "2rem",
            }}
          >
            Fetching data... Please wait
          </Typography>

          <Typography
            variant="body2"
            sx={{
              marginBottom: isMobile ? 2 : 3,
              color: "#7f8c8d",
              fontSize: isMobile ? "0.85rem" : "1rem",
              lineHeight: 1.4,
            }}
          >
            {loadingProgress.currentFile}
          </Typography>

          {/* Individual File Progress Bars */}
          <Box sx={{ width: "100%", marginBottom: isMobile ? 1.5 : 2 }}>
            {/* Map Data Progress */}
            <Box sx={{ marginBottom: 1 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 0.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: "#2c3e50", fontWeight: 500 }}
                >
                  Map Data
                </Typography>
                <Typography variant="caption" sx={{ color: "#7f8c8d" }}>
                  {Math.round(loadingProgress.fileProgress.map)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={loadingProgress.fileProgress.map}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "#ecf0f1",
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: "#3498db",
                    borderRadius: 2,
                  },
                }}
              />
            </Box>

            {/* Population Data Progress */}
            <Box sx={{ marginBottom: 1 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 0.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: "#2c3e50", fontWeight: 500 }}
                >
                  Population Data
                </Typography>
                <Typography variant="caption" sx={{ color: "#7f8c8d" }}>
                  {Math.round(loadingProgress.fileProgress.population)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={loadingProgress.fileProgress.population}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "#ecf0f1",
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: "#3498db",
                    borderRadius: 2,
                  },
                }}
              />
            </Box>

            {/* COVID-19 Data Progress */}
            <Box sx={{ marginBottom: 1 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 0.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: "#2c3e50", fontWeight: 500 }}
                >
                  COVID-19 Data
                </Typography>
                <Typography variant="caption" sx={{ color: "#7f8c8d" }}>
                  {Math.round(loadingProgress.fileProgress.covid)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={loadingProgress.fileProgress.covid}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "#ecf0f1",
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: "#3498db",
                    borderRadius: 2,
                  },
                }}
              />
            </Box>
          </Box>

          {/* Progress Text */}
          <Typography
            variant="caption"
            sx={{
              color: "#7f8c8d",
              fontSize: isMobile ? "0.7rem" : "0.75rem",
            }}
          >
            Step {loadingProgress.currentStep} of {loadingProgress.totalSteps} •{" "}
            {Math.round(loadingProgress.overallProgress)}% complete
          </Typography>

          {/* File size and download speed info */}
          {loadingProgress.fileSize && (
            <Typography
              variant="caption"
              sx={{
                color: "#95a5a6",
                fontSize: isMobile ? "0.65rem" : "0.7rem",
                display: "block",
                marginTop: 0.5,
              }}
            >
              {loadingProgress.fileSize}{" "}
              {loadingProgress.downloadSpeed &&
                `• ${loadingProgress.downloadSpeed}`}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  return null;
}
