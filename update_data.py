#!/usr/bin/env python3
import requests
import os

file_path = os.path.realpath(__file__)
file_dir = os.path.split(file_path)[0]
output_filepath = os.path.join(file_dir, "public/data/COVID-19_aantallen_gemeente_cumulatief.csv")

if __name__ == "__main__":
    DATA_URL = "https://data.rivm.nl/covid-19/COVID-19_aantallen_gemeente_cumulatief.csv"

    print("Downloading file...")
    req = requests.get(DATA_URL)
    assert req.status_code == 200

    with open(output_filepath, "w") as f:
        f.write(req.text)

    print("Success.File written!")
