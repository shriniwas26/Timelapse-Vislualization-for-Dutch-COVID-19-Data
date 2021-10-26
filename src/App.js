import './App.css';
import React, { } from 'react'
import * as d3 from 'd3';
import 'bootstrap/dist/css/bootstrap.css'; // or include from a CDN
import 'react-bootstrap-range-slider/dist/react-bootstrap-range-slider.css';
import RangeSlider from 'react-bootstrap-range-slider';
import Moment from 'moment'
import Button from 'react-bootstrap/Button'

// import Slider from 'react-rangeslider'

const ANIMATION_DELAY = 50;
const PER_POPULATION = 1E5;
const REPORTED_FIELD = "Daily_reported_moving_average";

const areaCodeToGmCode = (x) => {
    return "GM" + x.toString().padStart(4, '0');
}

class App extends React.Component {

    constructor(props) {
        super(props);
        this.ref = React.createRef();
        this.state = {
            populationData: null,
            nlGeoJson: null,
            dailyReportedByDay: null,

            // Animation related state
            selectedDayNr: 1,
            numberOfDays: null,
            colorScale: null,
            covidMap: null,
            isPlaying: false
        }
    }

    componentDidMount() {
        const urls = [
            "data/nl.json",
            "data/NL_Population_Latest.csv",
            "data/COVID-19-NL-Municipality-Wise.csv"
        ]

        Promise.all(urls.map(url =>
            fetch(url)
                .then(response => response.text())
        ))
            .then(([nlGeoJsonText, populationDataText, covidDataText]) => {
                const nlGeoJson = JSON.parse(nlGeoJsonText);
                const covidData = d3.csvParse(covidDataText);
                const populationData = d3.csvParse(populationDataText);
                populationData.forEach(e => {
                    populationData[e["Regions"]] = + e["PopulationOn1January_1"]
                });


                const covidDataDict = {}
                covidData.forEach(e => {
                    if (e["Municipality_code"] === undefined) {
                        return;
                    }
                    if (!(e["Municipality_code"] in populationData)) {
                        console.warn(`No population data for ${e["Municipality_name"]}`);
                    }
                    const adjustedReported = e[REPORTED_FIELD] / populationData[e["Municipality_code"]] * PER_POPULATION;
                    covidDataDict[e["Municipality_code"]] = adjustedReported;
                });

                const populationAdjustedCovidData = covidData.map(elem => {
                    const rowData = {};

                    rowData["Date_of_report"] = Moment(elem["Date_of_report"]).format("YYYY, MMMM DD");
                    rowData["Municipality_code"] = elem["Municipality_code"];
                    rowData[REPORTED_FIELD] = Math.round(
                        elem[REPORTED_FIELD] /
                        populationData[elem["Municipality_code"]] * PER_POPULATION
                    );
                    return rowData;
                });
                const maxVal = 100 * Math.ceil(1 / 100 * d3.max(populationAdjustedCovidData.map(e => e[REPORTED_FIELD])))
                const medVal = d3.mean(populationAdjustedCovidData.map(e => e[REPORTED_FIELD]))

                const dailyReportedByDay = d3.group(populationAdjustedCovidData, x => x["Date_of_report"]);

                let projection = d3.geoMercator()
                    .scale(5000)
                    .center([7, 52]);


                const svg = d3.select(this.ref.current);

                populationData.forEach(e => {
                    populationData[e["Regions"]] = + e["PopulationOn1January_1"]
                })

                const colorScale = d3.scaleLinear()
                    // .base(1.1)
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
                ;
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
                    .style("stroke-width", 0.5)
                    ;

                legendsvg
                    .append("text")
                    .attr("class", "legendTitle")
                    .attr("x", 0)
                    .attr("y", 2)
                    .text(`Number of cases per ${PER_POPULATION} people`);

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


                // Draw the map
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
                    // set the color of each Municiaplity
                    .attr("fill", e => {
                        const currentReported = covidDataDict[areaCodeToGmCode(e.properties.areaCode)];
                        return colorScale(currentReported);
                    });


                this.setState({
                    nlGeoJson: nlGeoJson,
                    populationData: populationData,
                    covidData: covidData,
                    dailyReportedByDay: dailyReportedByDay,
                    numberOfDays: dailyReportedByDay.size,
                    colorScale: colorScale,
                    covidMap: covidMap
                });


            });


        d3.select(this.ref.current)
            .attr("width", 600)
            .attr("height", 450)
        // .style("border", "5px solid grey")
    }

    redraw = (dayNumber) => {

        const selectedDayIdx = Math.min(
            Math.max(0, dayNumber),
            this.state.numberOfDays - 1
        );

        const dayKey = [...this.state.dailyReportedByDay.keys()][selectedDayIdx];
        const dailyData = this.state.dailyReportedByDay.get(dayKey);

        const dailyDict = {};
        dailyData.forEach(e => {
            dailyDict[e["Municipality_code"]] = e[REPORTED_FIELD];
        });

        const svg = d3.select(this.ref.current);

        svg.select("text")
            .transition()
            .duration(ANIMATION_DELAY)
            .text(`Day: ${dayKey}`)
            ;

        this.state.covidMap
            .transition()
            .duration(ANIMATION_DELAY)
            .ease(d3.easePoly)
            .attr("fill", e => {
                const currentReported = dailyDict[areaCodeToGmCode(e.properties.areaCode)];
                if (currentReported === undefined) {
                    return "grey";
                }

                if (currentReported === null) {
                    return "black";
                }

                return this.state.colorScale(currentReported);
            });
    } // end redraw()

    componentDidUpdate() {
        if (this.state.selectedDayNr >= this.state.numberOfDays) {
            console.log("Setting state to 0")
            this.setState({
                selectedDayNr: 0,
                isPlaying: false
            })
        }

        if (this.state.isPlaying) {
            if (this.state.selectedDayNr < this.state.numberOfDays - 1) {
                setTimeout(() => {
                    this.setState({
                        selectedDayNr: this.state.selectedDayNr + 1
                    })
                }, 40);
            }
        }
    }


    render() {
        if (this.state.populationData !== null) {
            this.redraw(this.state.selectedDayNr);
        }

        return (
            <div className="m-5 w-50 col-12 justify-content-center" >
                <svg ref={this.ref}>
                </svg>
                <br></br>
                <RangeSlider
                    className='justify-content-center'
                    style={{ align: "center" }}
                    min={0}
                    max={this.state.numberOfDays - 1}
                    step={1}
                    value={this.state.selectedDayNr}
                    tooltipPlacement={"top"}
                    tooltip='auto'
                    aria-label="Calendar day"
                    tooltipLabel={i => {
                        if (this.state.dailyReportedByDay === null) {
                            return null;
                        }
                        else {
                            return [...this.state.dailyReportedByDay.keys()][i]
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
                {/* <br></br> */}
                <Button
                    className='m-1'
                    onClick={() => {
                        this.setState({
                            selectedDayNr: 0,
                            isPlaying: false
                        })
                    }}
                >
                    Reset
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
            </div>

        )
    }
}

export default App;
