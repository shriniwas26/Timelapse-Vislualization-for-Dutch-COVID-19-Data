import './App.css';
import React, { } from 'react';
import * as d3 from 'd3';
import * as fc from 'd3fc';
import 'bootstrap/dist/css/bootstrap.css';
import Moment from 'moment';
import Button from 'react-bootstrap/Button';
import { Slider, CircularProgress, Typography } from '@mui/material';
let _ = require('lodash');

const ANIMATION_DELAY = 50;
const PER_POPULATION = 100_000;
const REPORTED_FIELD = "Total_reported";
const DAILY_REPORTED_FIELD = "Daily_" + REPORTED_FIELD;
const DAILY_REPORTED_FIELD_MA = "Daily_" + REPORTED_FIELD + "_ma";
const MOVING_AVG_WINDOW = 14;

if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    // dev code
    window.d3 = d3;
    window.moment = Moment;
}

const areaCodeToGmCode = (x) => {
    return "GM" + x.toString().padStart(4, '0');
};

const movingAvg = (inputArr, maWin) => {
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

class App extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            // Data
            populationData: null,
            nlGeoJson: null,
            covidDataGroupedByDay: null,
            sliderMarks: [],

            // Animation related state
            selectedDayIdx: 0,
            numberOfDays: 1,
            colorScale: null,
            isPlaying: false
        };
    }

    idxToStringDate = (i) => {
        if (this.state.covidDataGroupedByDay === null) {
            return null;
        }
        else {
            const s = this.state.covidDataGroupedByDay[i].date;
            return s.format("DD MMM, YYYY");
        }
    };

    componentDidMount() {
        const urls = [
            "data/nl-compact.json",
            "data/NL_Population_Latest.csv",
            "data/COVID-19_aantallen_gemeente_cumulatief_min.csv"
        ];

        Promise.all(urls.map(url =>
            fetch(url)
                .then(response => response.text())
        ))
            .then(([nlGeoJsonText, populationDataText, covidDataText]) => {
                const nlGeoJson = JSON.parse(nlGeoJsonText);
                const covidData = d3.csvParse(
                    covidDataText,
                    d3.autoType
                );
                const populationData = d3.csvParse(
                    populationDataText,
                    d3.autoType
                );

                const populationDataDict = Object.fromEntries(
                    populationData.map(elem => {
                        return [
                            elem["Regions"],
                            elem["PopulationOn31December_20"]
                        ];
                    })
                );

                /** Calculate daily values */
                const covidDataGroupedByMunicipality = d3.group(
                    covidData,
                    x => x["Municipality_code"]
                );

                covidDataGroupedByMunicipality.forEach(munData => {
                    munData.sort((a, b) => a["Date_of_report"] > b["Date_of_report"] ? 1 : -1);

                    munData[0][DAILY_REPORTED_FIELD] = munData[0][REPORTED_FIELD];
                    for (let i = 1; i < munData.length; i++) {
                        munData[i][DAILY_REPORTED_FIELD] =
                            munData[i][REPORTED_FIELD] - munData[i - 1][REPORTED_FIELD];
                    }
                    // Compute moving average
                    const movingAvgArr = movingAvg(
                        munData.map(
                            d => d[DAILY_REPORTED_FIELD]
                        ),
                        MOVING_AVG_WINDOW
                    );
                    for (let i = 0; i < munData.length; i++) {
                        munData[i][DAILY_REPORTED_FIELD_MA] = movingAvgArr[i];
                    }
                });

                const covidDataDiffed = Array.from(covidDataGroupedByMunicipality)
                    .map(x => x[1])
                    .flat();

                const populationAdjustedCovidData = covidDataDiffed.map(elem => {
                    const rowData = {};
                    rowData["Date_of_report"] = Moment(elem["Date_of_report"]).format("YYYY-MM-DD");
                    rowData["Municipality_code"] = elem["Municipality_code"];
                    rowData[DAILY_REPORTED_FIELD_MA] = Math.round(
                        elem[DAILY_REPORTED_FIELD_MA] /
                        populationDataDict[elem["Municipality_code"]] * PER_POPULATION
                    );
                    return rowData;
                });

                const maxVal = 100 * Math.ceil(1 / 100 * d3.max(
                    populationAdjustedCovidData.map(e => e[DAILY_REPORTED_FIELD_MA])));
                const medVal = d3.mean(
                    populationAdjustedCovidData.map(e => e[DAILY_REPORTED_FIELD_MA]));

                /*
                covidDataGroupedByDay should finally look like this:
                [
                    {
                        "date": 2020-10-22
                        "data": {
                            "GM0001": 12,
                            "GM0002": 1,
                            "GM0003": 3,
                            ...
                            ...
                            ...
                        }
                    },
                    {
                        "date": 2020-10-23
                        "data": {
                            "GM0001": 7,
                            "GM0002": 8,
                            "GM0003": 11,
                            ...
                            ...
                            ...
                        }
                    },
                    ...
                    ...
                ]

                */


                const covidDataGroupedByDay = Array.from(
                    d3.group(populationAdjustedCovidData, x => x["Date_of_report"]),
                    ([date, data]) => {
                        return {
                            date: Moment(date, "YYYY-MM-DD"),
                            data: Object.fromEntries(
                                data.map(
                                    e => [e["Municipality_code"], e[DAILY_REPORTED_FIELD_MA]]
                                )
                            )
                        };
                    }
                );
                covidDataGroupedByDay.sort((x, y) => x.date > y.date ? 1 : -1);

                populationData.forEach(e => {
                    populationData[e["Regions"]] = + e["PopulationOn1January_1"];
                });

                const colorScale = d3.scaleLinear()
                    .domain([0, medVal, maxVal])
                    .range(["white", "orange", "red"]);

                this.initialMapRender(nlGeoJson, medVal, maxVal, colorScale);

                window.removeEventListener('resize', this.resizeMapThrottled);
                window.addEventListener('resize', this.resizeMapThrottled);


                const yearMarks = [];
                covidDataGroupedByDay.forEach((element, idx) => {

                    if (
                        element.date.dayOfYear() === 1 ||
                        element.date.dayOfYear() === 181
                    ) {
                        yearMarks.push({
                            value: idx,
                            label: element.date.format("MMM YYYY"),
                        });
                    }
                });

                this.setState({
                    nlGeoJson: nlGeoJson,
                    populationData: populationData,
                    covidData: covidData,
                    covidDataGroupedByDay: covidDataGroupedByDay,
                    numberOfDays: covidDataGroupedByDay.length,
                    colorScale: colorScale,
                    sliderMarks: yearMarks
                });
            });


        const svg = d3.select('#svg-nl-map')
            .attr("height", "60vh");

        svg
            .append("p")
            .attr("x", 300)
            .attr("height", 225)
            .text("Loading...")
            .attr("font-weight", "700");
        // .style("border", "5px solid grey")
    }

    initialMapRender = (nlGeoJson, medVal, maxVal, colorScale) => {
        const svg = d3.select('#svg-nl-map');
        svg.empty();

        const legendSvgGroup = svg
            .append("g")
            .classed("legend-group", true);

        const [legendWidth, legendHeight] = [0.04 * window.innerWidth, 0.25 * window.innerHeight];
        // Band scale for x-axis
        const xScale = d3
            .scaleBand()
            .domain([0, 1])
            .range([0, legendWidth]);

        // Linear scale for y-axis
        const yScale = d3
            .scaleLinear()
            .domain([maxVal, 0])
            .range([0, legendHeight]);

        const expandedDomain = [
            ...d3.range(0, medVal, (medVal / legendHeight)),
            ...d3.range(medVal, maxVal + (maxVal / legendHeight), (maxVal / legendHeight))
        ];

        // Defining the legend bar
        const svgBar = fc
            .autoBandwidth(fc.seriesSvgBar())
            .xScale(xScale)
            .yScale(yScale)
            .crossValue(0)
            .baseValue((_, i) => (i > 0 ? expandedDomain[i - 1] : 0))
            .mainValue(d => d)
            .decorate(selection => {
                selection.selectAll("path").style("fill", d => {
                    return colorScale(d);
                });
            });

        // Add the legend bar
        const legendBar = legendSvgGroup
            .append("g")
            .datum(expandedDomain)
            .call(svgBar);

        // Defining our label
        const axisLabel = fc
            .axisRight(yScale)
            .tickValues([0, medVal, maxVal]);

        // Drawing and translating the label
        const barWidth = Math.abs(legendBar.node().getBoundingClientRect().width);
        legendSvgGroup.append("g")
            .attr("transform", `translate(${barWidth / 2},0)`)
            .datum(expandedDomain)
            .call(axisLabel)
            .select(".domain");

        legendSvgGroup
            .attr("transform", `translate(${0.02 * window.innerWidth}, 20)`);

        const toolDiv = d3.select("#chartArea")
            .append("div")
            .style("visibility", "hidden")
            .style("position", "absolute")
            .style("background-color", "skyblue")
            .style("font", "14px times")
            .style("border-radius", "10px")
            .style("box-sizing", "border-box")
            .style("padding", "10px")
            ;

        // Draw the map
        const projection = d3.geoMercator()
            .fitSize([window.innerWidth / 2, window.innerHeight / 2], nlGeoJson);

        svg.append("g")
            .attr("id", "path-group")
            .classed("nl-map", true)
            .selectAll("path")
            .join()
            .data(nlGeoJson.features)
            .enter()
            .append("path")
            .attr("stroke", "black")
            .attr("stroke-width", 1.0)
            // draw each Municiaplity
            .attr("d", d3.geoPath()
                .projection(projection)
            )
            .attr("id", d => areaCodeToGmCode(d.properties.areaCode))
            .on("mouseover", (e, d) => {
                d3
                    .select(e.target)
                    .attr("stroke-width", 4.0);

                toolDiv
                    .style("visibility", "visible")
                    .text(`Municipality: ${d.properties.areaName}`);
            })
            .on('mousemove', (e, _d) => {
                toolDiv
                    .style('top', (e.pageY - 50) + 'px')
                    .style('left', (e.pageX - 50) + 'px');
            })
            .on('mouseout', (e) => {
                toolDiv.style('visibility', 'hidden');
                d3
                    .select(e.target)
                    .attr("stroke-width", 1.0);
            })
            ;
    };

    resizeMap = () => {
        console.debug(`Resizing map to ${window.innerWidth} x ${window.innerHeight} screen-size`);
        const projection = d3.geoMercator()
            .fitSize([window.innerWidth / 2, window.innerHeight / 2], this.state.nlGeoJson);

        d3.select('#svg-nl-map')
            .selectAll(".nl-map path")
            .join()
            .transition(1)
            .duration(0)
            .attr("d", d3.geoPath().projection(projection));
    };

    resizeMapThrottled = _.throttle(this.resizeMap, 1000, { leading: false, trailing: true });

    redrawDay = (dayIdx) => {
        const dailyDict = this.state.covidDataGroupedByDay[dayIdx].data;

        d3.select('#svg-nl-map')
            .selectAll("#path-group path")
            .transition()
            .duration(ANIMATION_DELAY)
            .ease(d3.easePoly)
            .attr("fill", e => {
                const currentReported = dailyDict[areaCodeToGmCode(e.properties.areaCode)];
                if (currentReported === undefined) {
                    return "rgb(170, 170, 170)";
                }

                if (currentReported === null) {
                    return "rgb(255, 255, 255)";
                }

                return this.state.colorScale(currentReported);
            });
    }; // end redraw()

    componentDidUpdate() {
        if (this.state.selectedDayIdx >= this.state.numberOfDays) {
            this.setState({
                selectedDayIdx: 0,
                isPlaying: false
            });
        }

        if (this.state.isPlaying) {
            setTimeout(
                () => {
                    this.setState({
                        selectedDayIdx: (this.state.selectedDayIdx + 1) % this.state.numberOfDays
                    });
                },
                ANIMATION_DELAY
            );
        }
    }

    render() {
        const isRenderable = (this.state.populationData !== null) &&
            (this.state.nlGeoJson !== null) &&
            (this.state.covidDataGroupedByDay !== null);

        if (isRenderable) {
            this.redrawDay(this.state.selectedDayIdx);
        }

        return (
            <div
                id="chartArea"
                className="m-5 w-75 col-12 justify-content-center"
            >
                {/* <p><Badge bg="primary">{
                    this.state.covidDataGroupedByDay === null ? "" : this.idxToStringDate(this.state.selectedDayIdx)
                }
                </Badge></p> */}
                {
                    this.state.covidDataGroupedByDay === null ?
                        <div style={{ "height": "90%" }}>
                            <CircularProgress />
                        </div> :
                        <div style={{ "visibility": "hidden" }}></div>
                }
                <Typography variant="h4" component="h4">
                    COVID-19 Data in the Netherlands.
                </Typography>
                <Typography variant="subtitle1" gutterBottom>
                    Number of cases per {Intl.NumberFormat('en-US').format(PER_POPULATION)} people.
                </Typography>
                <svg id='svg-nl-map' className="m-1 w-75 col-12">
                </svg>
                <br />
                <div className='m-5 w-75 col-12 justify-content-center'>
                    <Slider
                        min={0}
                        max={this.state.numberOfDays - 1}
                        step={1}
                        defaultValue={0}
                        marks={this.state.sliderMarks}
                        aria-label="Always visible"
                        value={this.state.selectedDayIdx}
                        valueLabelDisplay="on"
                        valueLabelFormat={this.idxToStringDate}
                        onChange={(_changeEvent, newValue) => {
                            this.setState({
                                selectedDayIdx: parseInt(newValue),
                                isPlaying: false
                            });
                        }}
                    />
                    <br />
                    <Button
                        className='m-1'
                        onClick={() => {
                            this.setState({
                                selectedDayIdx: 0,
                                isPlaying: false
                            });
                        }}
                    >
                        Reset
                    </Button>
                    <Button
                        className='m-1'
                        onClick={() => {
                            this.setState({
                                selectedDayIdx: (this.state.selectedDayIdx - 1) % this.state.numberOfDays,
                                isPlaying: false
                            });
                        }}
                    >
                        Previous
                    </Button>
                    <Button
                        className='m-1'
                        onClick={() => {
                            this.setState({
                                isPlaying: !this.state.isPlaying
                            });
                        }}
                    >
                        Play/Pause
                    </Button>
                    <Button
                        className='m-1'
                        onClick={() => {
                            this.setState({
                                selectedDayIdx: this.state.selectedDayIdx + 1,
                                isPlaying: false
                            });
                        }}
                    >
                        Next
                    </Button>
                </div>
            </div>

        );
    }
}

export default App;
