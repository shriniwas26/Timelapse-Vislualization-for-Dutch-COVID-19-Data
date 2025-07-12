import { Box, useMediaQuery, useTheme } from "@mui/material";
import "bootstrap/dist/css/bootstrap.css";
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { Controls } from "./components/Controls";
import { DataLoader } from "./components/DataLoader";
import { LegendBox } from "./components/LegendBox";
import { MapRenderer } from "./components/MapRenderer";
import { LoadedData } from "./types";

const ANIMATION_DELAY = 50;

function App(): React.JSX.Element {
  // State
  const [loadedData, setLoadedData] = useState<LoadedData | null>(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

  // Responsive design
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Ref to track current day for smooth animation
  const currentDayRef = useRef<number>(0);

  // Update ref when selectedDayIdx changes
  useEffect(() => {
    currentDayRef.current = selectedDayIdx;
  }, [selectedDayIdx]);

  const handleDayChange = useCallback(
    (dayIdx: number, fromAnimation: boolean = false) => {
      setSelectedDayIdx(dayIdx);
      // Only stop playing if it's a manual change, not from animation
      if (!fromAnimation) {
        setIsPlaying(false);
      }
    },
    []
  );

  // Animation effect - removed selectedDayIdx from dependencies
  useEffect(() => {
    if (isPlaying && loadedData) {
      const timer = setTimeout(() => {
        const nextDay = (selectedDayIdx + 1) % loadedData.numberOfDays;
        handleDayChange(nextDay, true); // Mark as animation change
      }, ANIMATION_DELAY);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isPlaying, loadedData, selectedDayIdx, handleDayChange]); // Added selectedDayIdx and handleDayChange back

  const handleDataLoaded = useCallback((data: LoadedData) => {
    setLoadedData(data);
    setIsDataLoaded(true);
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
          <DataLoader onDataLoaded={handleDataLoaded} />

          {loadedData && (
            <Box
              sx={{
                display: "flex",
                gap: 0,
                height: "100%",
                width: "100%",
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <MapRenderer
                nlGeoJson={loadedData.nlGeoJson}
                covidDataGroupedByDay={loadedData.covidDataGroupedByDay}
                colorScale={loadedData.colorScale}
                selectedDayIdx={selectedDayIdx}
                isDataLoaded={isDataLoaded}
                isPlaying={isPlaying}
              />

              {/* Mobile legend overlay */}
              {isMobile && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    zIndex: 1000,
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    padding: "8px",
                    width: "30%",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  }}
                >
                  <LegendBox
                    min={loadedData.colorScale.domain()[0]}
                    mid={loadedData.colorScale.domain()[1]}
                    max={loadedData.colorScale.domain()[2]}
                    colorScale={loadedData.colorScale}
                    isMobile={true}
                  />
                </Box>
              )}

              {/* Desktop legend */}
              {!isMobile && (
                <Box
                  sx={{
                    width: 250,
                    height: "100%",
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
                    isMobile={false}
                  />
                </Box>
              )}
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
          isMobile={isMobile}
          isSmallMobile={isSmallMobile}
        />
      )}
    </>
  );
}

export default App;
