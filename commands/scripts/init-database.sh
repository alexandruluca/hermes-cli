#!/usr/bin/env bash

echo "Initializing database..."

db_user=''
db_user_password=''
db=''
dump_file=''

while getopts 'u:p:d:f:' flag; do
  case "${flag}" in
    u) db_user="${OPTARG}" ;;
    p) db_user_password="${OPTARG}" ;;
    d) db="${OPTARG}" ;;
    f) dump_file="${OPTARG}" ;;
    *) error "Unexpected option ${flag}" ;;
  esac
done

if [ -z ${db_user} ]
then
 echo "ERROR: db username is empty, provide with -u {username}"
 exit 1
fi;

if [ -z ${db_user_password} ]
then
 echo "ERROR: db user password is empty, provide with -p {password}"
 exit 1
fi;

if [ -z ${db} ]
then
 echo "ERROR: db is empty, provide with -d {database}"
 exit 1
fi;

mongo ${db} -u ${db_user} -p ${db_user_password} --eval "var colls = db.getCollectionNames(); colls.forEach(function(colName) {print('dropping ' + colName); db.getCollection(colName).drop();})"

if [ ! -z ${dump_file} ]
then
 #restore database to an initial state
 mongorestore -u ${db_user} -p ${db_user_password} --db launchbase ${dump_file}
else
 echo "no dumpfile was given for db ${db}, skipping db restore"
fi
