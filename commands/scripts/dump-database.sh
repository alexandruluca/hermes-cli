#!/usr/bin/env bash

username=''
password=''

while getopts 'u:p:' flag; do
  case "${flag}" in
    u) username="${OPTARG}" ;;
    p) password="${OPTARG}" ;;
    *) error "Unexpected option ${flag}" ;;
  esac
done

if [ -z ${username} ]
then
 echo "error: db username is empty"
 exit 1
fi;

if [ -z ${password} ]
then
 echo "error: db user password is empty"
 exit 1
fi;


mongodump -u ${username} -p ${password} -d launchbase