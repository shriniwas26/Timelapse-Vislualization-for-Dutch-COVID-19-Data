import './App.css';
import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3';

function App() {
    const ref = useRef();

    useEffect(() => {
        d3.select(ref.current)
            .attr("width", 800)
            .attr("height", 600)
            .style("border", "1px solid black")
    }, []);

    useEffect(() => {
        draw();
    }, []);

    const draw = () => {
        const ANIMATION_DELAY = 75;
        const PER_POPULATION = 1E5;
        const REPORTED_FIELD = "Daily_reported_moving_average";

        let projection = d3.geoMercator()
            .scale(5000)
            .center([7, 52])

        const areaCodeToGmCode = (x) => {
            return "GM" + x.toString().padStart(4, '0');
        }

        console.log("draw() called...")
        const svg = d3.select(ref.current);

        // fetch("data/NL_Population_Latest.csv")
        //     .then(response => response.text())
        //     .then((tContent) => {
        //         const populationData = d3.csvParse(tContent)
        //         console.log(populationData)
        //     })

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
                const populationData = d3.csvParse(populationDataText)
                let covidData = d3.csvParse(covidDataText)
                const nlGeoJson = JSON.parse(nlGeoJsonText);

                nlGeoJsonText = null;
                covidDataText = null;
                populationDataText = null;

                populationData.forEach(e => {
                    populationData[e["Regions"]] = + e["PopulationOn1January_1"]
                })


                const covidDataDict = {}
                covidData.forEach(e => {
                    if (e["Municipality_code"] === undefined) {
                        return;
                    }
                    if (!(e["Municipality_code"] in populationData)) {
                        // console.warn(`No population data for ${e["Municipality_name"]}`);
                    }
                    const adjustedReported = e[REPORTED_FIELD] / populationData[e["Municipality_code"]] * PER_POPULATION;
                    covidDataDict[e["Municipality_code"]] = adjustedReported;
                });

                const populationAdjustedCovidData = covidData.map(elem => {
                    const rowData = {};
                    rowData["Date_of_report"] = elem["Date_of_report"];
                    rowData["Municipality_code"] = elem["Municipality_code"];
                    rowData[REPORTED_FIELD] = Math.round(
                        elem[REPORTED_FIELD] /
                        populationData[elem["Municipality_code"]] * PER_POPULATION
                    );
                    return rowData;
                });
                const maxVal = 100 * Math.ceil(1 / 100 * d3.max(populationAdjustedCovidData.map(e => e[REPORTED_FIELD])))
                // const medVal = d3.median(populationAdjustedCovidData.map(e => e[REPORTED_FIELD]))

                covidData = null;

                console.log(covidDataDict);
                console.log(`Max daily reported = ${maxVal}`)


                const colorScale = d3.scaleLog()
                    .base(1.1)
                    .domain([1, maxVal / 2, maxVal])
                    .range(["white", "orange", "red"]);

                svg.append("text")
                    .text("Date goes here")
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
                            .tickValues([0, maxVal / 2, maxVal])
                    )
                    .attr("class", "legendAxis")
                    .attr("id", "legendAxis")
                    .attr(
                        "transform",
                        "translate(0, 20)"
                    );


                // Draw the map
                const covidMap = svg.append("g")
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
                    })
                    ;

                /* Group by date of report and perform animations */
                const dailyReportedByDay = d3.group(populationAdjustedCovidData, x => x["Date_of_report"])
                let i = 0;
                dailyReportedByDay.forEach((dailyData, key) => {
                    i++;
                    const dailyDict = {};
                    dailyData.forEach(e => {
                        dailyDict[e["Municipality_code"]] = e[REPORTED_FIELD];
                    });

                    svg.select("text")
                        .transition()
                        .delay(ANIMATION_DELAY * i)
                        .duration(ANIMATION_DELAY)
                        .text(`Day: ${key}`)
                        ;

                    covidMap
                        .transition()
                        .delay(ANIMATION_DELAY * i)
                        .duration(ANIMATION_DELAY)
                        .ease(d3.easeLinear)
                        .attr("fill", e => {
                            const currentReported = dailyDict[areaCodeToGmCode(e.properties.areaCode)];
                            if (currentReported === undefined) {
                                return "grey";
                            }

                            if (currentReported === null) {
                                return "black";
                            }

                            return colorScale(currentReported);
                        })
                        ;
                });







            }) // End: promise fetch


    }

    return (
        <div className="chart">
            <svg ref={ref}>
            </svg>
        </div>

    )
}

export default App;
