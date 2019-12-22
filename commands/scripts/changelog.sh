#!/usr/bin/env bash

tags=$(git tag --sort=-v:refname | grep -v v)

compare_tags=$(echo $tags | awk -F' '  '{print $2".."$1}')

diff=$(git log --pretty=oneline --abbrev-commit $compare_tags)

tag_diff=$(printf "${diff}\n " | sed -e ':a' -e 'N' -e '$!ba' -e 's/\n/<br>/g')

echo ${tag_diff}
