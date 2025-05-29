#!/bin/bash


#pip install -r requirements.txt


sudo apt install python3-passlib python3-jose python3-multipart python3-fastapi python3-uvicorn python3-sqlalchemy python3-pydantic python3-jinja2 python3-aiofiles python3-pytest python3-httpx python3-bcrypt python3-passlib python3-reportlab -y



sudo cp radiotrack.service /etc/systemd/system
sudo systemctl enable radiotrack.service
sudo systemctl start radiotrack.service
