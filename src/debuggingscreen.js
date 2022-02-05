var appVersion = "2.0.0"
var betaTest = false
var DecompressZip = require('decompress-zip')
var md5File = require('md5-file')
var md5FilePromise = require('md5-file/promise')
var Steps = {"CHECK_LANGUAGE": -3, "GET_COIN_LIST": -2, "PREPARE": -1, "START":0, "GET_DATA": 1, "CHECK_WALLET_VERSION": 2, "DOWNLOAD_WALLET_VERSION": 3, "CHECK_PARAMS":4, "DOWNLOAD_PARAMS":5, "CHECK_BLOCKCHAIN": 6, "DOWNLOAD_BLOCKCHAIN": 7, "CHECK_DAEMON":9, "DOWNLOAD_DAEMON": 10, "START_DAEMON": 11, "OPENING_WALLET": 12, "FINISH": 13, "CHECK_DATA_FOLDER": 14, "SHOW_POPUP": 15, "CHECK_JS": 16, "END": 17}
var CheckType = {"SERVER":0, "DAEMON": 1}
var GetAllDataType = {"ALL":0, "WITH_BALANCE":1, "WITH_TRANSACTIONS":2, "NONE":3}
var ScreenType = {"LOADING":0, "OVERVIEW": 1, "SEND":2, "SHIELD":3, "ADDRESSES": 4, "TRANSACTIONS": 5, "MASTERNODES": 6, "MASTERNODES_CONFIG": 7, "APPS": 8, "EXCHANGES": 9, "SETTINGS": 10, 'MASTERNODES_MAP': 11, 'ADDRESSBOOK': 13, 'VOTING': 14}
var MsgType = {
  "ALERT": 0, "CONFIRMATION": 1, "DELETE": 2, "EDITMN": 3, "UBUNTU_VERSION": 4, "DAEMON_LOCATION": 5, 'DEPENDENCIES': 6, 'DEFAULT_SETTINGS': 7, "ADD_PEERS": 8, "DEBUG": 9, "GET_PEERS": 10, "SELECTCOIN": 11, "AUTO_DOWNLOAD_DAEMON": 12, "AUTO_DOWNLOAD_BLOCKCHAIN": 13, "LOADING_RESTART_WALLET": 14, "LOADING_DAEMON": 15, "CUSTOM_DATA": 16, "DATA_LOCATION": 17, "CONFIRMATION2": 18, "MASTERNODE_OPTION": 19, "SELECT_COIN_SETTINGS": 20, "SEND_CONFIRMATION": 21, "SEND_MANY": 22, "BUDGET_VOTE": 23,
  "UNLOCK": 24, "CHANGE_PASS": 25, "ENCRYPT": 26
}
var SendType = {"NORMAL":0, "SHIELD": 1, "PUBLIC": 2}
var UpdateDataType = {"COINLIST": 0, "SELECTCOIN": 1, "DATATYPE": 2 , "DOWNLOADBLOCKCHAIN": 3, "DOWNLOADFILE": 4, "CHECKDAEMON": 5, "AUTODOWNLOAD": 6,
"APPLYLOCATION": 7, "CUSTOMDATA": 8, "NEWVERSION": 9, "APPLYCUSTOMDATA": 10, "AUTODOWNLOADBLOCKCHAIN": 11, "DEPENDENCIESACTION": 12, "ERRORDAEMON": 13, "SELECTCOINSETTINGS": 14, "SELECTLINUX": 15, "RESTART": 16}
var LanguageType = {"AE": "ae", "CN": "cn", "CZ": "cz", "DE": "de", "EN": "en", "ES": "es", "FR": "fr", "HU": "hu", "IT": "it", "KR": "kr", "NL": "nl", "PL": "pl", "RO": "ro", "RU": "ru", "TR": "tr"}
function getNameFromUrl(element)
{
  url = element.replace("https:\\", "https://");
  var splits = url.split('/')
  return splits[splits.length - 1]
}

var app = angular.module('debuggingscreen', ['pascalprecht.translate'])
var electron = require('electron')
var fs = require('fs')
var fsextra = require('fs-extra')
var miningProcess = require('child_process')
var readLastLines = require('read-last-lines')
var ipc = electron.ipcRenderer
window.$ = window.jQuery = require("../../global/vendor/jquery/jquery.js");
var remote = require('electron').remote
var request = require('request')
var dialog = electron.remote.dialog
var args = remote.process.argv
var path = require('path')

app.controller('DebuggingCtrl', ["$scope", "$http", "$timeout", "$translate", "$rootScope", function($scope, $http, $timeout, $translate, $rootScope) {
  $scope.detail = {}
  $scope.settings = undefined
  function getDebugFile(settings){
    return path.join(settings.datafolder, 'debug.log');
  }

  electron.ipcRenderer.on('debugging-update-settings', function(event, msgData){
    $timeout(function(){
      $scope.settings = msgData.msg[0]
      if (serverData && serverData.linuxoss) $scope.oss = serverData.linuxoss
    },0)
  })

  readLog()
  function readLog(){
    if($scope.settings)
    {
      readLastLines.read(getDebugFile($scope.settings), 18)
      .then((lines) => {
        console.log(lines)
        $timeout(function(){
          $scope.detail.log = lines.split('\n').filter(function () { return true });
          readLog()
        }, 100)
      })
    }
    else
    {
      setTimeout(() => {
        readLog()
      }, 1000);
    }
  }
}])

// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
var minimizeButton = document.getElementById('minimize-button')
var maxButton = document.getElementById('min-max-button')
var restoreButton = document.getElementById('restore-button')
var closeButton = document.getElementById('close-button')
var closeButtonDebugging = document.getElementById('close-button-debugging')
var switchCoinButton = document.getElementById('switch-coin-button')

var minimizeButtonEnd = document.getElementById('minimize-button-end')
var maxButtonEnd = document.getElementById('min-max-button-end')
var restoreButtonEnd = document.getElementById('restore-button-end')

if(minimizeButton)
{
  minimizeButton.addEventListener('click', function () {
    remote.getCurrentWindow().minimize()
  })
}

if(maxButton)
{
  maxButton.addEventListener('click', function () {
    var currentWindow = remote.getCurrentWindow()
    currentWindow.maximize()
  })
}

if(restoreButton)
{
  restoreButton.addEventListener('click', function () {
    var currentWindow = remote.getCurrentWindow()
    currentWindow.unmaximize()
  })
}

if(closeButton)
{
  closeButton.addEventListener('click', function () {
    electron.ipcRenderer.send('main-close-window')
  })
}

if(closeButtonDebugging)
{
  closeButtonDebugging.addEventListener('click', function () {
    electron.ipcRenderer.send('main-close-debugging')
  })
}

if(switchCoinButton)
{
  switchCoinButton.addEventListener('click', function () {
    var arg = {}
    arg.type = MsgType.SELECT_COIN_SETTINGS
    arg.title = 'Select Coin'
    electron.ipcRenderer.send('main-update-data-splash', {type: UpdateDataType.SELECTCOINSETTINGS, data: arg})
  })
}


if(minimizeButtonEnd)
{
  minimizeButtonEnd.addEventListener('click', function () {
    remote.getCurrentWindow().minimize()
  })
}

if(maxButtonEnd)
{
  maxButtonEnd.addEventListener('click', function () {
    var currentWindow = remote.getCurrentWindow()
    currentWindow.maximize()
  })
}

if(restoreButtonEnd)
{
  restoreButtonEnd.addEventListener('click', function () {
    var currentWindow = remote.getCurrentWindow()
    currentWindow.unmaximize()
  })
}

function toggleMaxRestoreButtons() {
  var window = remote.getCurrentWindow();
  if (window.isMaximized()) {
    maxButton ? maxButton.style.display = "none" : ""
    restoreButton ? restoreButton.style.display = "flex" : ""
    maxButtonEnd ? maxButtonEnd.style.display = "none" : ""
    restoreButtonEnd ? restoreButtonEnd.style.display = "flex" : ""
  } else {
    restoreButton ? restoreButton.style.display = "none" : ""
    maxButton ? maxButton.style.display = "flex" : ""
    restoreButtonEnd ? restoreButtonEnd.style.display = "none" : ""
    maxButtonEnd ? maxButtonEnd.style.display = "flex" : ""
  }
}

electron.ipcRenderer.on('child-toggle-screen', function(event, msgData) {
  toggleMaxRestoreButtons()
  console.log("toggle screen")
  ipc.send('main-update-chart', undefined)
})