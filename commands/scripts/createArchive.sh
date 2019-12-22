#!/bin/bash

# Creates a zip from the current path
exportpath=''

while getopts 'e:' flag; do
  case "${flag}" in
    e) exportpath="${OPTARG}" ;;
    *) error "Unexpected option ${flag}" ;;
  esac
done

zip -r "--exclude=*.git*" ${exportpath} .
