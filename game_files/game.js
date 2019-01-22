var PlayersManager    = require('./playersManager'),
    PipeManager       = require('./pipeManager'),
    CollisionEngine   = require('./collisionEngine'),
    enums             = require('./enums'),
    ManagerFile   = require('fs'),
    Const             = require('../sharedConstants').constant;

var _playersManager,
    _pipeManager,
    io,
    _gameState,
    _timeStartGame,
    _lastTime = null;


function playerLog (socket, nick) {
  // Retreive PlayerInstance
  socket.get('PlayerInstance', function (error, player) {
    if (error)
      console.error(error);
    else {

      // Bind new client events
      socket.on('change_ready_state', function (readyState) {
        // If the server is currently waiting for players, update ready state
        if (_gameState == enums.ServerState.WaitingForPlayers) {
          _playersManager.changeLobbyState(player, readyState);
          socket.broadcast.emit('player_ready_state', player.getPlayerObject());
        }
      });
      socket.on('player_jump', function () {
        player.jump();
      });

      console.log(nick);
      // Set player's nickname and prepare him for the next game
      _playersManager.prepareNewPlayer(player, nick);
      // Add Player information here - Update the posX and PosY for migration.
      //  Update the bird location here is just when starting

      // var playerObject = player.getPlayerObject();
      // var combPlayerInfo = playerObject.id + '/' + playerObject.nick + '/' +  playerObject.color + '/' + String(playerObject.posX) + '/' + String(playerObject.posY);
      // playerManagerFile.appendFile(Const.PLAYER_FOLDER, combPlayerInfo + '\r\n', function(err){
      //     if (err) console.log(err);
      //     console.log("Successfully Written to playerManagerFile.");
      // });
      // Notify new client about other players AND notify other about the new one ;)
      socket.emit('player_list', _playersManager.getPlayerList());
      socket.broadcast.emit('new_player', player.getPlayerObject());
    }
  });
}

function updateGameState (newState, notifyClients) {
  var log = '\t[SERVER] Game state changed ! Server is now ';
  
  _gameState = newState;
  switch (_gameState) {
    case enums.ServerState.WaitingForPlayers:
      log += 'in lobby waiting for players';
      break;
    //  case: enums.ServerState.Migrate:
    //       log += 'Server is migrating'
    //       break;
    case enums.ServerState.OnGame:
      log += 'in game !';
      break;
    case enums.ServerState.Ranking:
      log += 'displaying ranking';
      break;
    case enums.ServerState.Migrating:
      log += 'migrating';
      break;

    default:
      log += 'dead :p'
  }
  console.info(log);

  // If requested, inform clients qbout the chsnge
  if (notifyClients)
    io.sockets.emit('update_game_state', _gameState);
}

function createNewGame () {
  var players,
      i;

  // Flush pipe list
  _pipeManager.flushPipeList();

  // Reset players state and send it
  players = _playersManager.resetPlayersForNewGame();
  for (i = 0; i < players.length; i++) {
    io.sockets.emit('player_ready_state', players[i]);
  };

  // Notify players of the new game state
  updateGameState(enums.ServerState.WaitingForPlayers, true);
};

function gameOver() {
  var players,
      i;

  // Stop game loop
  clearInterval(_timer);
  _lastTime = null;

  // Change server state
  updateGameState(enums.ServerState.Ranking, true);

  // Send players score
  _playersManager.sendPlayerScore();

  // After 5s, create a new game
  setTimeout(createNewGame, Const.TIME_BETWEEN_GAMES);
};


function gameRecovery(ellapsedTime) {
    var players,
        i;

    // Update pipe list
    _pipeManager.updatePipes(ellapsedTime);

    _playersManager.updatePlayers(ellapsedTime);
    lenPlaysers =_playersManager.getPlayerList(enums.PlayerState.Playing);
    // Reset players state and send it
    // players = _playersManager.resetPlayersForNewGame();
    for (i = 0; i < lenPlaysers; i++) {
        io.sockets.emit('player_ready_state', players[i]);
    };

    // Notify players of the restored game state
    updateGameState(enums.ServerState.OnGame, true);
}

function gameMigrate(ellapsedTime){
  //This function will run in the loop, so state would be saved for the each time frame

  // Change server state
  // updateGameState(enums.ServerState.Migrating, true);
  // do something here util the state is back to OnGame

  // Transfer the require state to the destination
  // updateGameState(enums.ServerState.OnGame, true)
  // show the time here

  var players,
      i;

  // Stop game loop
  clearInterval(_timer);
  _lastTime = null;

  // Change server state
  updateGameState(enums.ServerState.Ranking, true);

  // Send players score
  _playersManager.sendPlayerScore();

  //First step is to try to make it recover
  //  After 5s, recover the game
  setTimeout(gameRecovery(ellapsedTime), Const.TIME_BETWEEN_GAMES);
  // After 5s, create a new game
  // setTimeout(createNewGame, Const.TIME_BETWEEN_GAMES);

}

function startGameLoop_recovery (cb_pipe_list) {

    // Change server state
    updateGameState(enums.ServerState.OnGame, true);
    // Create the first pipe

    _pipeManager.newPipe(); // change it

    _pipeManager.CallBackPipeList(cb_pipe_list);

    // Start timer
    _timer = setInterval(function() {
      var now = new Date().getTime(),
          ellapsedTime = 0,
          plList;

      // get time difference between the last call and now
      if (_lastTime) {
        ellapsedTime = now - _lastTime;
      }
      else {
        _timeStartGame = now;
      }

      _lastTime = now;

      // If everyone has quit the game, exit it
      if (_playersManager.getNumberOfPlayers() == 0) {
        gameOver();
      }

      //should update the player to the list here
      // Update players position
      _playersManager.updatePlayers(ellapsedTime);

      // Should update the pip to the list here
      // Update pipes
      _pipeManager.updatePipes(ellapsedTime);

      var playerlist = _playersManager.getPlayerList(enums.PlayerState.Playing);
      // this will only be applied for single player
      for (var p_i = 0; p_i < playerlist.length; p_i++){
        nplayer = playerlist[p_i];
        var playerObject = nplayer.getPlayerObject();
        var combPlayerInfo = playerObject.id + '/' + playerObject.nick + '/' +  playerObject.color + '/' + String(playerObject.posX) + '/' + String(playerObject.posY);
          ManagerFile.appendFile(Const.PLAYER_FOLDER, combPlayerInfo + '\r\n', function(err){
            if (err) console.log(err);
            console.log("Successfully Written to playerManagerFile.");
        });
      }

      // Check collisions
      if (CollisionEngine.checkCollision(_pipeManager.getPotentialPipeHit(), _playersManager.getPlayerList(enums.PlayerState.Playing)) == true) {
        if (_playersManager.arePlayersStillAlive() == false) {
          gameOver();
          //gameMigrate(ellapsedTime);
        }
      }

      // Maybe set the timeout for the migration
      // if (migration == true){
      // Update player position _playersManager.updatePlayers(ellapsedTime);

      //gameMigrate();

      // }

      // Notify players
      io.sockets.emit('game_loop_update', { players: _playersManager.getOnGamePlayerList(), pipes: _pipeManager.getPipeList()});

    }, 1000 / 60);
}


exports.recoveryServer = function () {
    io = require('socket.io').listen(Const.SOCKET_PORT);
    io.configure(function(){
        io.set('log level', 2);
    });

    var p_id,
        p_name,
        p_color,
        p_PosX,
        p_posY;

    // Create playersManager instance and register events
    _playersManager = new PlayersManager();

    // Get player info from file
    var player_list = ManagerFile.readFileSync(Const.PLAYER_FOLDER).toString();

    lines = player_list.trim().split('\n');
    var lastLine = lines.slice(-1)[0];
    // console.log(lastLine);

    var player_info = lastLine.split("/");

    p_id = player_info[0];
    p_name = player_info[1];
    p_color = player_info[2];
    p_PosX = player_info[3];
    p_posY = player_info[4];

    // Read pine info
    var pipe_info = ManagerFile.readFileSync(Const.PIPE_FOLDER).toString();
    // How many pipes should we take?
    var cb_pipe_list = pipe_info.trim().split('\n');
    // console.log(pipe_list);

    _gameState = enums.ServerState.OnGame;

    //  Load player from file

    _playersManager.on('players-ready', function () {
        startGameLoop_recovery(cb_pipe_list);
    });

    // Create pipe manager and bind event
    _pipeManager = new PipeManager();
    _pipeManager.on('need_new_pipe', function () {
        // Create a pipe and send it to clients
        var pipe = _pipeManager.newPipe();
    });

    // On new client connection
    io.sockets.on('connection', function (socket) {
        // Call back player
        var player = _playersManager.CallBackPlayer(socket, p_id, p_name, p_color, p_PosX, p_posY);
        // Register to socket events
        socket.on('disconnect', function () {
            socket.get('PlayerInstance', function (error, player) {
                _playersManager.removePlayer(player);
                socket.broadcast.emit('player_disconnect', player.getPlayerObject());
                player = null;
            });
        });
        socket.on('say_hi', function (nick, fn) {
            fn(_gameState, player.getID());
            playerLog(socket, player.getNick());
        });

        // Remember PlayerInstance and push it to the player list
        socket.set('PlayerInstance', player);
    });


    console.log('Game started and waiting for players on port ' + Const.SOCKET_PORT);
};