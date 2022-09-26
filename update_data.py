#!/usr/bin/env python3
import pandas as pd
import os

file_path = os.path.realpath(__file__)
file_dir = os.path.split(file_path)[0]
output_filepath = os.path.join(
    file_dir, "public/data/COVID-19_aantallen_gemeente_cumulatief.csv"
)
output_filepath_min = os.path.join(
    file_dir, "public/data/COVID-19_aantallen_gemeente_cumulatief_min.csv"
)
DATA_URL = "https://data.rivm.nl/covid-19/COVID-19_aantallen_gemeente_cumulatief.csv"

if __name__ == "__main__":

    print("Downloading file...")
    covid_data = pd.read_csv(DATA_URL, delimiter=";")
    covid_data.to_csv(
        output_filepath,
        index=False,
    )

    covid_data["Date_of_report"] = pd.to_datetime(covid_data["Date_of_report"]).dt.date
    covid_data.to_csv(
        output_filepath_min,
        index=False,
        columns=[
            "Date_of_report",
            "Municipality_code",
            "Total_reported",
        ]
    )
    print("Success. File written!")
