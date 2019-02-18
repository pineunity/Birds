pkill -f node

sudo service lsyncd restart

cd /home/ubuntu/Birds

node server.js

echo "Terminated time"

echo $(($(date +%s%N)/1000000))

