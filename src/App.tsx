import { Box, CircularProgress, Typography } from "@mui/material";
import "bootstrap/dist/css/bootstrap.css";
import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { Controls } from "./components/Controls";
import { DataLoader } from "./components/DataLoader";
import { LegendBox } from "./components/LegendBox";
import { MapRenderer } from "./components/MapRenderer";
import { LoadedData } from "./types";

const ANIMATION_DELAY = 50;

function App(): JSX.Element {
  // State
  const [loadedData, setLoadedData] = useState<LoadedData | null>(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

  // Animation effect
  useEffect(() => {
    if (isPlaying && loadedData) {
      const timer = setTimeout(() => {
        setSelectedDayIdx((prev) => (prev + 1) % loadedData.numberOfDays);
      }, ANIMATION_DELAY);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, selectedDayIdx, loadedData]);

  const handleDataLoaded = useCallback((data: LoadedData) => {
    setLoadedData(data);
    setIsDataLoaded(true);
  }, []);

  const handleDayChange = useCallback((dayIdx: number) => {
    setSelectedDayIdx(dayIdx);
    setIsPlaying(false);
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleReset = useCallback(() => {
    setSelectedDayIdx(0);
    setIsPlaying(false);
  }, []);

  const handlePrevious = useCallback(() => {
    if (loadedData) {
      setSelectedDayIdx(
        (selectedDayIdx - 1 + loadedData.numberOfDays) % loadedData.numberOfDays
      );
      setIsPlaying(false);
    }
  }, [loadedData, selectedDayIdx]);

  const handleNext = useCallback(() => {
    if (loadedData) {
      setSelectedDayIdx((selectedDayIdx + 1) % loadedData.numberOfDays);
      setIsPlaying(false);
    }
  }, [loadedData, selectedDayIdx]);

  return (
    <>
      <div className="map-box">
        <div className="map-container">
          {!isDataLoaded ? (
            <div
              style={{
                height: "20%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <CircularProgress />
              <Typography variant="body1" color="text.secondary">
                Loading COVID-19 data...
              </Typography>
            </div>
          ) : (
            <div style={{ visibility: "hidden" }}></div>
          )}

          <DataLoader onDataLoaded={handleDataLoaded} />

          {loadedData && (
            <Box sx={{ display: "flex", gap: 0, height: "100%" }}>
              <Box sx={{ flex: 1 }}>
                <MapRenderer
                  nlGeoJson={loadedData.nlGeoJson}
                  covidDataGroupedByDay={loadedData.covidDataGroupedByDay}
                  colorScale={loadedData.colorScale}
                  selectedDayIdx={selectedDayIdx}
                  isDataLoaded={isDataLoaded}
                />
              </Box>
              <Box
                sx={{
                  width: 250,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <LegendBox
                  min={loadedData.colorScale.domain()[0]}
                  mid={loadedData.colorScale.domain()[1]}
                  max={loadedData.colorScale.domain()[2]}
                  colorScale={loadedData.colorScale}
                />
              </Box>
            </Box>
          )}
        </div>
      </div>
      {loadedData && (
        <Controls
          selectedDayIdx={selectedDayIdx}
          numberOfDays={loadedData.numberOfDays}
          sliderMarks={loadedData.sliderMarks}
          isPlaying={isPlaying}
          isDataLoaded={isDataLoaded}
          covidDataGroupedByDay={loadedData.covidDataGroupedByDay}
          onDayChange={handleDayChange}
          onPlayPause={handlePlayPause}
          onReset={handleReset}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )}
    </>
  );
}

export default App;
