#!/bin/bash


pip install -r requirements.txt

sudo cp radiotrack.service /etc/systemd/system
sudo systemctl enable vspgradiotrack_core.service
sudo systemctl start radiotrack.service
