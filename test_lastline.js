var fs = require('fs');
Const   = require('./sharedConstants').constant;

var global_data = fs.readFileSync(Const.PLAYER_FOLDER).toString();

lines = global_data.trim().split('\n');
var lastLine = lines.slice(-1)[0];
// console.log(lastLine);
var sp_line = lastLine.split('/');
console.log(sp_line[4]);


var pipe_info = fs.readFileSync(Const.PIPE_FOLDER).toString();

var pipe_list = pipe_info.trim().split('\n');

// console.log(pipe_list[0]);
console.log(pipe_list.length);