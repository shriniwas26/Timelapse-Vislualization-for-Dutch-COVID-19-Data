import { Slider, Typography } from "@mui/material";
import { useCallback } from "react";
import Button from "react-bootstrap/Button";
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

  return (
    <div className="m-5 w-75 col-12 justify-content-center">
      <Typography variant="h4" component="h4">
        COVID-19 Data in the Netherlands.
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Number of cases per {Intl.NumberFormat("en-US").format(100_000)} people.
      </Typography>
      <br />
      <Slider
        min={0}
        max={numberOfDays - 1}
        step={1}
        defaultValue={0}
        marks={sliderMarks}
        aria-label="Always visible"
        value={selectedDayIdx}
        valueLabelDisplay="on"
        valueLabelFormat={idxToStringDate}
        onChange={(_changeEvent, newValue) => {
          const newDayIdx = parseInt(newValue.toString());
          onDayChange(newDayIdx);
        }}
      />
      <br />
      <Button className="m-1" onClick={onReset}>
        Reset
      </Button>
      <Button className="m-1" onClick={onPrevious}>
        Previous
      </Button>
      <Button className="m-1" onClick={onPlayPause}>
        Play/Pause
      </Button>
      <Button className="m-1" onClick={onNext}>
        Next
      </Button>
    </div>
  );
}
