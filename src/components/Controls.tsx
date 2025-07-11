import { Box, IconButton, Slider, Tooltip, Typography } from "@mui/material";
import { useCallback } from "react";
import { DayData } from "../types";

interface ControlsProps {
  selectedDayIdx: number;
  numberOfDays: number;
  sliderMarks: Array<{ value: number; label: string }>;
  isPlaying: boolean;
  isDataLoaded: boolean;
  covidDataGroupedByDay: DayData[] | null;
  onDayChange: (dayIdx: number) => void;
  onPlayPause: () => void;
  onReset: () => void;
  onPrevious: () => void;
  onNext: () => void;
  isMobile?: boolean;
  isSmallMobile?: boolean;
}

export function Controls({
  selectedDayIdx,
  numberOfDays,
  sliderMarks,
  isPlaying,
  isDataLoaded,
  covidDataGroupedByDay,
  onDayChange,
  onPlayPause,
  onReset,
  onPrevious,
  onNext,
  isMobile = false,
  isSmallMobile = false,
}: ControlsProps) {
  const idxToStringDate = useCallback(
    (i: number): string | null => {
      if (!isDataLoaded || covidDataGroupedByDay === null) {
        return null;
      } else {
        const s = covidDataGroupedByDay[i].date;
        return s.format("DD MMM, YYYY");
      }
    },
    [covidDataGroupedByDay, isDataLoaded]
  );

  if (!isDataLoaded) {
    return null;
  }

  const buttonSize = isSmallMobile ? 44 : isMobile ? 48 : 40;
  const playButtonSize = isSmallMobile ? 52 : isMobile ? 56 : 48;

  return (
    <Box
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        backgroundColor: "#fff",
        borderTop: "4px solid #e9ecef",
        marginTop: "32px",
        padding: isMobile ? "12px 0 8px 0" : "18px 0 14px 0",
        zIndex: 1200,
        display: "block",
      }}
    >
      <Box
        sx={{
          maxWidth: "700px",
          margin: "0 auto",
          width: "100%",
          padding: isMobile ? "0 12px" : "0",
        }}
      >
        {/* Header */}
        <Box
          sx={{ textAlign: "center", marginBottom: isMobile ? "10px" : "15px" }}
        >
          <Typography
            variant={isMobile ? "h6" : "h4"}
            component="h1"
            sx={{
              fontWeight: 600,
              color: "#2c3e50",
              marginBottom: "5px",
              fontSize: isSmallMobile
                ? "1.1rem"
                : isMobile
                ? "1.3rem"
                : "2.125rem",
            }}
          >
            COVID-19 Data in the Netherlands
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              color: "#7f8c8d",
              fontSize: isMobile ? "0.8rem" : "0.9rem",
            }}
          >
            Number of cases per {Intl.NumberFormat("en-US").format(100_000)}{" "}
            people
          </Typography>
        </Box>

        {/* Current Date Display */}
        <Box
          sx={{ textAlign: "center", marginBottom: isMobile ? "12px" : "20px" }}
        >
          <Typography
            variant={isMobile ? "body1" : "h6"}
            sx={{
              color: "#e74c3c",
              fontWeight: 500,
              backgroundColor: "#fdf2f2",
              padding: isMobile ? "6px 12px" : "8px 16px",
              borderRadius: "20px",
              display: "inline-block",
              border: "1px solid #fadbd8",
              fontSize: isSmallMobile
                ? "0.9rem"
                : isMobile
                ? "1rem"
                : "1.25rem",
            }}
          >
            {idxToStringDate(selectedDayIdx)}
          </Typography>
        </Box>

        {/* Slider */}
        <Box
          sx={{
            marginBottom: isMobile ? "12px" : "20px",
            padding: isMobile ? "0 8px" : "0 20px",
          }}
        >
          <Slider
            min={0}
            max={numberOfDays - 1}
            step={1}
            value={selectedDayIdx}
            marks={sliderMarks}
            aria-label="Timeline slider"
            valueLabelDisplay="off"
            onChange={(_changeEvent, newValue) => {
              const newDayIdx = parseInt(newValue.toString());
              onDayChange(newDayIdx);
            }}
            sx={{
              "& .MuiSlider-track": {
                backgroundColor: "#e74c3c",
                height: isMobile ? 4 : 6,
              },
              "& .MuiSlider-rail": {
                backgroundColor: "#ecf0f1",
                height: isMobile ? 4 : 6,
              },
              "& .MuiSlider-thumb": {
                backgroundColor: "#e74c3c",
                border: "2px solid #fff",
                boxShadow: "0 2px 8px rgba(231, 76, 60, 0.3)",
                width: isMobile ? 20 : 24,
                height: isMobile ? 20 : 24,
                "&:hover": {
                  boxShadow: "0 4px 12px rgba(231, 76, 60, 0.4)",
                },
              },
              "& .MuiSlider-mark": {
                backgroundColor: "#bdc3c7",
                height: isMobile ? 6 : 8,
                width: 2,
              },
              "& .MuiSlider-markLabel": {
                color: "#7f8c8d",
                fontSize: isMobile ? "0.65rem" : "0.75rem",
                fontWeight: 500,
              },
            }}
          />
        </Box>

        {/* Control Buttons */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: isMobile ? "8px" : "10px",
          }}
        >
          <Tooltip title="Reset to beginning">
            <IconButton
              onClick={onReset}
              sx={{
                backgroundColor: "#ecf0f1",
                color: "#2c3e50",
                width: buttonSize,
                height: buttonSize,
                borderRadius: "50%",
                minWidth: 0,
                minHeight: 0,
                padding: 0,
                fontSize: isMobile ? "1.1rem" : "1rem",
                "&:hover": {
                  backgroundColor: "#d5dbdb",
                },
              }}
            >
              ↺
            </IconButton>
          </Tooltip>

          <Tooltip title="Previous day">
            <IconButton
              onClick={onPrevious}
              sx={{
                backgroundColor: "#ecf0f1",
                color: "#2c3e50",
                width: buttonSize,
                height: buttonSize,
                borderRadius: "50%",
                minWidth: 0,
                minHeight: 0,
                padding: 0,
                fontSize: isMobile ? "1.1rem" : "1rem",
                "&:hover": {
                  backgroundColor: "#d5dbdb",
                },
              }}
            >
              ⏮
            </IconButton>
          </Tooltip>

          <Tooltip title={isPlaying ? "Pause animation" : "Play animation"}>
            <IconButton
              onClick={onPlayPause}
              sx={{
                backgroundColor: "#e74c3c",
                color: "white",
                width: playButtonSize,
                height: playButtonSize,
                borderRadius: "50%",
                minWidth: 0,
                minHeight: 0,
                padding: 0,
                fontSize: isMobile ? "1.4rem" : "1.2rem",
                "&:hover": {
                  backgroundColor: "#c0392b",
                },
              }}
            >
              {isPlaying ? "⏸" : "▶"}
            </IconButton>
          </Tooltip>

          <Tooltip title="Next day">
            <IconButton
              onClick={onNext}
              sx={{
                backgroundColor: "#ecf0f1",
                color: "#2c3e50",
                width: buttonSize,
                height: buttonSize,
                borderRadius: "50%",
                minWidth: 0,
                minHeight: 0,
                padding: 0,
                fontSize: isMobile ? "1.1rem" : "1rem",
                "&:hover": {
                  backgroundColor: "#d5dbdb",
                },
              }}
            >
              ⏭
            </IconButton>
          </Tooltip>
        </Box>

        {/* Progress indicator */}
        <Box
          sx={{
            textAlign: "center",
            marginTop: isMobile ? "8px" : "10px",
            color: "#7f8c8d",
            fontSize: isMobile ? "0.7rem" : "0.8rem",
          }}
        >
          Day {selectedDayIdx + 1} of {numberOfDays}
        </Box>
      </Box>
    </Box>
  );
}
