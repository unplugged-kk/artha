#!/bin/sh
# This script builds and deploys the Artha backend and frontend to my private Kubernetes registry
# then restarts the Artha pods to use the new images.
# THIS IS NOT INTENDED FOR PUBLIC USE. DO NOT USE THIS AS A TEMPLATE FOR YOUR OWN PROJECTS.

set -e

REGISTRY=registry.laskonet.com/artha

cd ~/artha
echo "Building backend..."
docker build -t $REGISTRY/backend:latest --target production -f backend/Dockerfile .
echo "Pushing backend..."
docker push $REGISTRY/backend:latest

echo "Building frontend..."
docker build -t $REGISTRY/frontend:latest --target production ./frontend
echo "Pushing frontend..."
docker push $REGISTRY/frontend:latest

echo "Restarting pods..."
kubectl delete -n artha pod artha-backend-0 artha-frontend-0

echo "Done. Pods will restart automatically."
