import './App.css';
import React, { } from 'react';
import * as d3 from 'd3';
import 'bootstrap/dist/css/bootstrap.css';
import 'react-bootstrap-range-slider/dist/react-bootstrap-range-slider.css';
import { Spinner, Badge } from 'react-bootstrap';
import RangeSlider from 'react-bootstrap-range-slider';
import Moment from 'moment';
import Button from 'react-bootstrap/Button';

// import Slider from 'react-rangeslider'
// const DATA_URL = "https://data.rivm.nl/covid-19/COVID-19_aantallen_gemeente_cumulatief.csv"
const ANIMATION_DELAY = 40;
const PER_POPULATION = 1E5;
const REPORTED_FIELD = "Total_reported";
const DAILY_REPORTED_FIELD = "Daily_" + REPORTED_FIELD;
const DAILY_REPORTED_FIELD_MA = "Daily_" + REPORTED_FIELD + "_ma";
const MOVING_AVG_WINDOW = 14;

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
        this.ref = React.createRef();
        this.state = {
            populationData: null,
            nlGeoJson: null,
            covidDataGroupedByDay: null,

            // Animation related state
            selectedDayNr: 1,
            numberOfDays: null,
            colorScale: null,
            covidMap: null,
            isPlaying: false
        };
    }

    componentDidMount() {
        const urls = [
            "data/nl-compact.json",
            "data/NL_Population_Latest.csv",
            "data/COVID-19_aantallen_gemeente_cumulatief.csv"
        ];

        Promise.all(urls.map(url =>
            fetch(url)
                .then(response => response.text())
        ))
            .then(([nlGeoJsonText, populationDataText, covidDataText]) => {
                const nlGeoJson = JSON.parse(nlGeoJsonText);
                const covidData = d3.csvParse(
                    covidDataText.replaceAll(";", ","),
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
                    munData[0][DAILY_REPORTED_FIELD] = 0;
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
                    rowData["Date_of_report"] = Moment(elem["Date_of_report"]).format("YYYY, MMMM DD");
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

                const covidDataGroupedByDay = d3.group(populationAdjustedCovidData, x => x["Date_of_report"]);

                const svg = d3.select(this.ref.current);

                populationData.forEach(e => {
                    populationData[e["Regions"]] = + e["PopulationOn1January_1"];
                });

                const colorScale = d3.scaleLinear()
                    .domain([0, medVal, maxVal])
                    .range(["white", "orange", "red"]);

                svg.append("text")
                    .text("")
                    .attr("x", 10)
                    .attr("y", 25);


                const linearGradient = svg
                    .append("linearGradient")
                    .attr("id", "linear-gradient");

                linearGradient
                    .selectAll("stop")
                    .data([
                        { offset: "0%", color: "white" },
                        { offset: "50%", color: "orange" },
                        { offset: "100%", color: "red" },
                    ])
                    .enter()
                    .append("stop")
                    .attr("offset", d => d.offset)
                    .attr("stop-color", d => d.color);

                const legendsvg = svg
                    .append("g")
                    .attr("id", "legend")
                    .attr(
                        "transform",
                        "translate(10, 50)"
                    );

                //Draw the Rectangle
                legendsvg
                    .append("rect")
                    .attr("class", "legendRect")
                    .attr("x", 0)
                    .attr("y", 10)
                    .attr("width", 150)
                    .attr("height", 10)
                    .style("fill", "url(#linear-gradient)")
                    .style("stroke", "black")
                    .style("stroke-width", 0.5);

                legendsvg
                    .append("text")
                    .attr("class", "legendTitle")
                    .attr("x", 0)
                    .attr("y", 2)
                    .text(`Cases per ${PER_POPULATION / 1000}k people`);

                const legendScale = d3.scaleLinear()
                    .range([0, 150])
                    .domain([0, maxVal]);

                // x-axis
                legendsvg
                    .append("g")
                    .call(
                        d3
                            .axisBottom(legendScale)
                            .tickValues([0, medVal, maxVal])
                    )
                    .attr("class", "legendAxis")
                    .attr("id", "legendAxis")
                    .attr(
                        "transform",
                        "translate(0, 20)"
                    );

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
                let projection = d3.geoMercator()
                    .fitSize([window.innerWidth / 2, window.innerHeight / 2], nlGeoJson);

                const covidMap = svg.append("g")
                    .attr("id", "path-group")
                    .selectAll("path")
                    .data(nlGeoJson.features)
                    .enter()
                    .append("path")
                    .attr("stroke", "black")
                    .attr("stroke-width", 1.0)
                    // draw each Municiaplity
                    .attr("d", d3.geoPath()
                        .projection(projection)
                    )
                    .attr(
                        "transform",
                        "translate(50, 0)"
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
                    .on('mousemove', (e, d) => {
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

                this.setState({
                    nlGeoJson: nlGeoJson,
                    populationData: populationData,
                    covidData: covidData,
                    covidDataGroupedByDay: covidDataGroupedByDay,
                    numberOfDays: covidDataGroupedByDay.size,
                    colorScale: colorScale,
                    covidMap: covidMap
                });

            });


        const svg = d3.select(this.ref.current)
            .attr("width", "100%")
            .attr("height", "50vh");

        svg
            .append("p")
            .attr("x", 300)
            .attr("height", 225)
            .text("Loading...")
            .attr("font-weight", "700");
        // .style("border", "5px solid grey")
    }

    redraw = (dayNumber) => {

        const selectedDayIdx = Math.min(
            Math.max(0, dayNumber),
            this.state.numberOfDays - 1
        );

        const dayKey = [...this.state.covidDataGroupedByDay.keys()][selectedDayIdx];
        const dailyData = this.state.covidDataGroupedByDay.get(dayKey);

        const dailyDict = {};
        dailyData.forEach(e => {
            dailyDict[e["Municipality_code"]] = e[DAILY_REPORTED_FIELD_MA];
        });

        this.state.covidMap
            .transition()
            .duration(ANIMATION_DELAY)
            .ease(d3.easePoly)
            .attr("fill", e => {
                const currentReported = dailyDict[areaCodeToGmCode(e.properties.areaCode)];
                if (currentReported === undefined) {
                    return "rgb(170, 170, 170)";
                }

                if (currentReported === null) {
                    return "black";
                }

                return this.state.colorScale(currentReported);
            });
    }; // end redraw()

    componentDidUpdate() {
        if (this.state.selectedDayNr >= this.state.numberOfDays) {
            this.setState({
                selectedDayNr: 0,
                isPlaying: false
            });
        }

        if (this.state.isPlaying) {
            if (this.state.selectedDayNr < this.state.numberOfDays - 1) {
                setTimeout(() => {
                    this.setState({
                        selectedDayNr: this.state.selectedDayNr + 1
                    });
                }, 40);
            }
        }
    }


    render() {
        if (
            (this.state.populationData !== null) &&
            (this.state.nlGeoJson !== null) &&
            (this.state.covidDataGroupedByDay !== null)
        ) {
            this.redraw(this.state.selectedDayNr);
        }

        return (
            <div
                id="chartArea"
                className="m-5 w-75 h-75 col-12 justify-content-center"
            >
                <p><Badge bg="primary">{
                    this.state.covidDataGroupedByDay === null ? "" :
                    [...this.state.covidDataGroupedByDay.keys()][this.state.selectedDayNr]
                }
                </Badge></p>
                {
                    this.state.covidDataGroupedByDay === null ?
                        <div style={{ "height": "90%" }}>
                            <Spinner
                                animation="border"
                                role="status"
                                size="lg"
                                variant="primary"
                            >
                                <span className="visually-hidden">Loading...</span>
                            </Spinner>
                        </div> :
                        <div style={{ "visibility": "hidden" }}></div>
                }
                <svg ref={this.ref} className="m-1 w-75 col-12">
                </svg>
                <br />
                <div className='m-5 w-50 col-12 justify-content-center'>
                    <RangeSlider
                        style={{ align: "center" }}
                        min={0}
                        max={this.state.numberOfDays - 1}
                        step={1}
                        value={this.state.selectedDayNr}
                        tooltipPlacement={"top"}
                        tooltip='auto'
                        aria-label="Calendar day"
                        tooltipLabel={i => {
                            if (this.state.covidDataGroupedByDay === null) {
                                return null;
                            }
                            else {
                                return [...this.state.covidDataGroupedByDay.keys()][i];
                            }
                        }}
                        size={'sm'}
                        onChange={(changeEvent) => {
                            this.setState({
                                selectedDayNr: parseInt(changeEvent.target.value),
                                isPlaying: false
                            });
                        }}
                    />
                    <br />
                    <Button
                        className='m-1'
                        onClick={() => {
                            this.setState({
                                selectedDayNr: 0,
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
                                selectedDayNr: (this.state.selectedDayNr - 1) % this.state.numberOfDays,
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
                                selectedDayNr: this.state.selectedDayNr + 1,
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
