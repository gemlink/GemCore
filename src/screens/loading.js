app.controller("LoadingCtrl", [
  "$scope",
  "$http",
  "$timeout",
  "$translate",
  "$rootScope",
  function ($scope, $http, $timeout, $translate, $rootScope) {
    var loading = true; // set to true while we fetch the balances
    var serverUrl = "https://data.gemlink.org";
    var backupUrl = "https://data2.gemlink.org";
    var step = Steps.GET_COIN_LIST;
    var verifyingKeyMD5 = "21e8b499aa84b5920ca0cea260074f34";
    var provingKeyMD5 = "af23e521697ed69d8b8a6b9c53e48300";
    var counter = 0;
    var downloadTimer = undefined;
    var walletStatusTimer = undefined;
    $scope.detail = {};
    var req = undefined;
    $scope.server = undefined;
    $scope.port = undefined;
    $scope.detail.disableProgressbar = true;
    $scope.detail.noiticeSelectUbuntu = true;
    $scope.detail.popup = {};
    $scope.currentProcess = "Preparing";
    $scope.visible = true;
    $scope.detail.background = "../../assets/images/xsg-loading5.png";
    var autoLauncher;
    var currLoc = path.dirname(electron.remote.app.getPath("exe"));

    if (process.platform == "win32") {
      autoLauncher = new autoLaunch({
        name: "gemlink",
        path: currLoc.replace("/", "\\") + "\\" + "GemCore.exe",
      });
    } else if (process.platform == "linux") {
      autoLauncher = new autoLaunch({
        name: "gemlink",
        path: currLoc + "/" + "GemCore",
      });
    } else if (process.platform == "darwin") {
      autoLauncher = new autoLaunch({
        name: "gemlink",
        path: "/Applications/GemCore.app",
      });
    }

    $scope.ctrlTranslations = {};

    $rootScope.$on(
      "$translateChangeSuccess",
      function (event, current, previous) {
        // Language has changed
        $scope.getControllerTranslations();
      }
    );

    $scope.getControllerTranslations = function () {
      translationsAvailable().then(() => {
        $translate([
          "global.ok",
          "global.download",
          "global.version",
          "loadingView.currentProcess",
          "loadingView.getCoinList",
          "loadingView.checkCoin",
          "loadingView.selectCoinButton",
          "loadingView.getServerData",
          "loadingView.displayPopup",
          "loadingView.checkWalletVer",
          "loadingView.downloadWalletVer",
          "loadingView.checkParams",
          "loadingView.downloadParams",
          "loadingView.checkDaemon",
          "loadingView.downloadDaemon",
          "loadingView.daemonVerSelect",
          "loadingView.checkDataFolder",
          "loadingView.checkBlockchain",
          "loadingView.autoDownloadBlockchain",
          "loadingView.startDeamon",
          "loadingView.finishing",
          "loadingView.serverErr",
          "loadingView.blockchainServerErr",
          "loadingView.downloadNewFiles",
          "loadingView.downloadQuestion",
          "loadingView.isAvailable",
          "loadingView.checking",
          "loadingView.selectBinaryFiles",
          "loadingView.starting",
          "loadingView.masternodePlan",
          "loadingView.verifyingWallet",
          "loadingView.loadingBlockIdx",
          "loadingView.verifyingBlocks",
          "loadingView.loadingWalletDaemon",
          "loadingView.rescanning",
          "loadingView.loadingAddresses",
          "loadingView.rewindingBlocks",
          "splashscreen.autoDaemonDownload",
          "splashscreen.defaultDataLocation",
        ]).then((o) => {
          $scope.currentProcess = o["loadingView.currentProcess"];
          $scope.ctrlTranslations = o;
        });
      });
    };

    $scope.getControllerTranslations();

    getPrice();
    prepareFiles(step);

    function checkLanguage(file, languageFolder, coinList) {
      if (!fs.existsSync(file) || !fs.existsSync(languageFolder)) {
        writeLog("Language pack does not exist, go to download page");
        return false;
      }
      validTranslations.forEach((t) => {
        if (!fs.existsSync(path.join(languageFolder, `${t}.json`))) {
          writeLog(`${t}.json` + " does not exist, go to download page");
          return false;
        }
      });
      var content = fs.readFileSync(file, "utf8");
      return content.toLowerCase() == coinList.languagechecksum.toLowerCase();
    }

    $scope.restartAction = function () {
      if (serverData != undefined && serverData.daemon != undefined) {
        isRunning(serverData.daemon, function (status) {
          var count = countOcurrences(status, serverData.daemon);
          if (count >= 1) {
            stopDaemon();
          }
        });
      }
      //check wallet status
      setTimeout(restartFunction, 500);
    };

    function spawnMessage(type, text, btnText, title) {
      $timeout(function () {
        var arg = {};
        arg.type = type;
        arg.text = typeof text == 'string' ? text : JSON.stringify(text, null, 2);
        arg.btnText = btnText;
        arg.title = title;
        ipc.send("main-show-popup", arg);
      });
    }

    function showPopup(imgUrl, redirectUrl) {
      $scope.detail.popup.imgUrl = imgUrl;
      $scope.detail.popup.redirectUrl = redirectUrl;
      $("#modalPopup").modal();
    }

    function updateScope(step) {
      $timeout(function () {
        $scope.currentProcess = step;
        ipc.send("main-update-scope", step);
      }, 0);
    }

    function prepareFiles(stepLocal) {
      setTimeout(function () {
        switch (stepLocal) {
          case Steps.GET_COIN_LIST:
            updateScope(
              ($scope.ctrlTranslations["loadingView.getCoinList"] ||
                "Getting coin list") + "..."
            );
            var temp = getCurrentCoin();
            if (temp != undefined) {
              currentCoin = temp;
            }
            settings = readSettings(currentCoin);
            if (settings.background != undefined) {
              $scope.detail.background = settings.background;
            }
            if (settings.bot != undefined && settings.apikey != undefined) {
              initBot(settings.bot, settings.apikey);
            }
            var arg = [settings, confData, serverData];
            ipc.send("main-update-settings", arg);
            getCoinList();
            break;
          case Steps.CHECK_LANGUAGE:
            var checksumLoc = getLanguageChecksumLoc();
            var languageDir = getLanguageDir();
            if (checkLanguage(checksumLoc, languageDir, coinList)) {
              step = Steps.PREPARE;
              prepareFiles(step);
            } else {
              updateScope(
                $scope.ctrlTranslations["loadingView.downloadLanguage"] ||
                  "Downloading language pack" + "..."
              );
              var temp = {};
              temp.url = coinList.languageurl;
              temp.saveFolder = languageDir;
              temp.name = "language";
              temp.checksumLoc = checksumLoc;
              temp.step = Steps.CHECK_LANGUAGE;
              ipc.send("main-update-data-splash", {
                type: UpdateDataType.DOWNLOADFILE,
                data: temp,
              });
            }
            break;
          case Steps.PREPARE:
            // @TODO get current coin
            updateScope(
              $scope.ctrlTranslations["loadingView.checkCoin"] + "..."
            );
            writeLog(currentCoin);
            // writeLog(JSON.stringify(coinList.coins))
            $scope.detail.coins = coinList.coins;
            ipc.send("main-update-data-splash", {
              type: UpdateDataType.COINLIST,
              data: $scope.detail.coins,
              currentCoin: currentCoin,
            });
            var index = coinList.coins.findIndex(function (e) {
              return e.name == currentCoin;
            });
            if (currentCoin == undefined || index == -1) {
              // @TODO show select coin alert

              writeLog("Show alert");
              spawnMessage(
                MsgType.SELECTCOIN,
                "",
                "",
                $scope.ctrlTranslations["loadingView.selectCoinButton"]
              );
            } else {
              step = Steps.GET_DATA;
              prepareFiles(step);
            }
            break;
          // case Steps.CHECK_JS:
          //   if(!isDevMode)
          //   {
          //     updateScope('Checking script update...')
          //     checkJsFile(coinList.jsmd5)
          //   }
          //   else
          //   {
          //     step = Steps.GET_DATA
          //     prepareFiles(step)
          //   }
          //   break
          case Steps.GET_DATA:
            updateScope(
              $scope.ctrlTranslations["loadingView.getServerData"] + "..."
            );
            getServerData();
            break;
          case Steps.SHOW_POPUP:
            var noticeData = {};
            noticeData.popup = serverData.popup;
            noticeData.banner = serverData.banner;
            electron.ipcRenderer.send("main-notification-data", noticeData);
            if (
              false &&
              checkNoticeDisplay(serverData) &&
              serverData.popup != undefined &&
              serverData.popup.length > 0
            ) {
              updateScope(
                $scope.ctrlTranslations["loadingView.displayPopup"] + "..."
              );
              var random = Math.floor(Math.random() * serverData.popup.length);
              showPopup(
                serverData.popup[random].imgUrl,
                serverData.popup[random].redirectUrl
              );
            } else {
              step = Steps.START;
              prepareFiles(step);
            }
            break;

          case Steps.START:
            serverData.walletversion = coinList.version.walletversion;
            serverData.detail = coinList.version.detail;
            //install dependencies
            start();
            break;
          case Steps.CHECK_WALLET_VERSION:
            updateScope(
              $scope.ctrlTranslations["loadingView.checkWalletVer"] + "..."
            );
            var shouldDownload = checkWalletVersion(serverData.walletversion);
            if (shouldDownload) {
              step = Steps.DOWNLOAD_WALLET_VERSION;
            } else {
              step = Steps.CHECK_PARAMS;
            }
            prepareFiles(step);
            break;
          case Steps.DOWNLOAD_WALLET_VERSION:
            updateScope(
              $scope.ctrlTranslations["loadingView.downloadWalletVer"] + "..."
            );
            downloadWallet(serverData.walletversion, serverData.detail);
            break;
          case Steps.CHECK_PARAMS:
            updateScope(
              $scope.ctrlTranslations["loadingView.checkParams"] + "..."
            );
            checkParams();
            break;
          case Steps.DOWNLOAD_PARAMS:
            updateScope(
              $scope.ctrlTranslations["loadingView.downloadParams"] + "..."
            );
            var temp = {};
            temp.url = serverData.paramsurl;
            temp.saveFolder = getParamsHome(serverData);
            temp.name = "params";
            temp.step = Steps.DOWNLOAD_PARAMS;
            ipc.send("main-update-data-splash", {
              type: UpdateDataType.DOWNLOADFILE,
              data: temp,
            });
            break;
          case Steps.CHECK_DAEMON:
            updateScope(
              $scope.ctrlTranslations["loadingView.checkDaemon"] + "..."
            );
            //@TODO
            //check daemon from server or local
            //if server
            if (settings.autoupdatedaemon == true) {
              checkDaemonFile();
            } else if (settings.autoupdatedaemon == false) {
              step = Steps.CHECK_DATA_FOLDER;
              prepareFiles(step);
            } else if (settings.autoupdatedaemon == undefined) {
              spawnMessage(
                MsgType.AUTO_DOWNLOAD_DAEMON,
                $scope.ctrlTranslations["splashscreen.autoDaemonDownload"],
                "",
                " "
              );
            }

            //if local

            break;
          case Steps.DOWNLOAD_DAEMON:
            updateScope(
              $scope.ctrlTranslations["loadingView.downloadDaemon"] + "..."
            );

            isRunning("daemon", function (status) {
              var count = countOcurrences(status, "daemon");
              if (count >= 1) {
                stopDaemon();
              }
            });
            if (process.platform == "win32") {
              var temp = {};
              temp.url = serverData.windowsdaemonurl;
              temp.saveFolder = getWalletHome(false, currentCoin);
              temp.name = "daemon";
              temp.step = Steps.DOWNLOAD_PARAMS;
              ipc.send("main-update-data-splash", {
                type: UpdateDataType.DOWNLOADFILE,
                data: temp,
              });
            } else if (process.platform == "linux") {
              spawnMessage(
                MsgType.UBUNTU_VERSION,
                "",
                $scope.ctrlTranslations["global.ok"],
                $scope.ctrlTranslations["loadingView.daemonVerSelect"]
              );
            } else {
              var temp = {};
              temp.url = serverData.macdaemonurl;
              temp.saveFolder = getWalletHome(false, currentCoin);
              temp.name = "daemon";
              temp.step = Steps.DOWNLOAD_PARAMS;
              ipc.send("main-update-data-splash", {
                type: UpdateDataType.DOWNLOADFILE,
                data: temp,
              });
            }
            break;
          case Steps.CHECK_DATA_FOLDER:
            updateScope(
              $scope.ctrlTranslations["loadingView.checkDataFolder"] + "..."
            );
            if (settings.datafolder == undefined) {
              spawnMessage(
                MsgType.CUSTOM_DATA,
                $scope.ctrlTranslations["splashscreen.defaultDataLocation"],
                "",
                " "
              );
            } else {
              step = Steps.CHECK_BLOCKCHAIN;
              prepareFiles(step);
            }
            break;
          case Steps.CHECK_BLOCKCHAIN:
            updateScope(
              $scope.ctrlTranslations["loadingView.checkBlockchain"] + "..."
            );
            var walletHome = getWalletHome(true);
            var file = walletHome + "/commands.txt";
            if (fs.existsSync(file)) {
              var content = fs.readFileSync(file, "utf8");
              fsextra.removeSync(file);
              args = args.concat(content.split("\n"));
            }
            var isExisted = checkBlockchain(serverData, args);
            if (!isExisted) {
              spawnMessage(
                MsgType.AUTO_DOWNLOAD_BLOCKCHAIN,
                $scope.ctrlTranslations["loadingView.autoDownloadBlockchain"],
                "",
                " "
              );
            } else {
              step = Steps.START_DAEMON;
              prepareFiles(step);
            }
            break;
          case Steps.DOWNLOAD_BLOCKCHAIN:
            //check txindex
            var homeDir = getUserHome(serverData, settings);
            if (fs.existsSync(homeDir + "/blocks")) {
              fsextra.removeSync(homeDir + "/blocks");
            }
            if (fs.existsSync(homeDir + "/chainstate")) {
              fsextra.removeSync(homeDir + "/chainstate");
            }
            if (fs.existsSync(homeDir + "/sporks")) {
              fsextra.removeSync(homeDir + "/sporks");
            }
            var filesUrl = serverData.blockchain_file;
            if (filesUrl && filesUrl.trim() != "") {
              request(filesUrl, function (error, response, body) {
                if (response == undefined || error) {
                  console.log("Request blockchain server error", error);
                  spawnMessage(
                    MsgType.ALERT,
                    $scope.ctrlTranslations["loadingView.blockchainServerErr"]
                  );
                } else {
                  try {
                    var dataFiles = JSON.parse(String(body));
                    var files = [];
                    if (confData.txindex == 1) {
                      files = dataFiles.index;
                    } else {
                      files = dataFiles.noindex;
                    }
                    if (isDevMode || betaTest) {
                      writeLog(files);
                    }
                    downloadBlockChain(
                      files,
                      getUserHome(serverData, settings)
                    );
                  } catch (err) {
                    console.log("err");
                    step = Steps.START_DAEMON;
                    prepareFiles(step);
                  }
                }
              });
            } else {
              step = Steps.START_DAEMON;
              prepareFiles(step);
            }
            //download file
            break;
          case Steps.START_DAEMON:
            //@TODO check if reindex or other agruments
            updateScope(
              $scope.ctrlTranslations["loadingView.startDeamon"] + "..."
            );
            ipc.send("main-start-wallet");
            if (process.platform != "win32") {
              var loc =
                getUserHome(serverData, settings) +
                (serverData.wallet == undefined
                  ? "/wallet.dat"
                  : "/" + serverData.wallet);

              if (settings.datafolder != undefined) {
                args.push("-datadir=" + settings.datafolder);
              }
              arg = [settings, confData, serverData];
              ipc.send("main-update-settings", arg);
              startWallet(args);
            } else {
              if (settings.datafolder != undefined) {
                args.push("-datadir=" + settings.datafolder);
              }
              arg = [settings, confData, serverData];
              ipc.send("main-update-settings", arg);
              startWallet(args);
            }
            break;
          case Steps.OPENING_WALLET:
            setTimeout(checkWalletStarting, 2000);
            break;
          case Steps.FINISH:
            updateScope(
              $scope.ctrlTranslations["loadingView.finishing"] + "..."
            );
            finishLoading(currentCoin, serverData);
            break;
          case Steps.END:
            writeLog("End\n\n\n");
            clearInterval(walletStatusTimer);
            var arg = [];
            ipc.send("main-self-close", arg);
            break;
        }
      }, 1000);
    }

    function getCoinList() {
      var coinlistPath = "/getcoins";
      if (isDevMode || betaTest) {
        coinlistPath = "/getcoinsbeta";
      }

      var request = require("request");
      request(serverUrl + coinlistPath, function (error, response, body) {
        console.log("error:", error, response, body); // Print the error if one occurred
        if (response == undefined || response.statusCode != 200) {
          request(backupUrl + coinlistPath, function (error, response, body) {
            console.log("error:", error); // Print the error if one occurred
            if (response == undefined || response.statusCode != 200) {
              spawnMessage(
                MsgType.ALERT,
                $scope.ctrlTranslations["loadingView.serverErr"]
              );
            } else {
              $scope.server = backupUrl;
              coinList = JSON.parse(String(body));
              if (isDevMode || betaTest) {
                writeLog(coinList);
              }
              step = Steps.CHECK_LANGUAGE;
              prepareFiles(step);
            }
          });
        } else {
          $scope.server = serverUrl;
          coinList = JSON.parse(String(body));
          step = Steps.CHECK_LANGUAGE;
          prepareFiles(step);
        }
      });
    }

    function getServerData() {
      var coinData =
        "/gemcore?coin=" + (currentCoin == undefined ? "gemlink" : currentCoin);
      if (isDevMode || betaTest) {
        coinData =
          "/gemcore/beta?coin=" +
          (currentCoin == undefined ? "gemlink" : currentCoin);
      }
      writeLog("Curent coin", currentCoin);
      var request = require("request");
      request($scope.server + coinData, function (error, response, body) {
        if (response == undefined) {
          spawnMessage(
            MsgType.ALERT,
            $scope.ctrlTranslations["loadingView.serverErr"]
          );
        } else {
          try {
            serverData = JSON.parse(String(body));
            if (isDevMode || betaTest) {
              writeLog(serverData);
            }
            step = Steps.SHOW_POPUP;
            prepareFiles(step);
          } catch (err) {
            spawnMessage(
              MsgType.ALERT,
              $scope.ctrlTranslations["loadingView.serverErr"]
            );
          }
        }
      });
    }

    function checkWalletVersion(ver) {
      if (appVersion < ver) {
        return true;
      } else {
        return false;
      }
    }

    function checkJsFile(md5) {
      var jsFolder = "resources/app/";
      var jsFolder2 = "resources/app/src/";
      var jsFile = jsFolder2 + "app.js";
      if (process.platform == "darwin") {
        jsFolder = __dirname;
        jsFolder2 = __dirname;
        jsFile = jsFolder2 + "/app.js";
      }
      if (!fs.existsSync(jsFolder)) {
        fs.mkdirSync(jsFolder);
        fs.mkdirSync(jsFolder2);
        downloadJsFile(jsFile);
      } else if (!fs.existsSync(jsFolder2)) {
        fs.mkdirSync(jsFolder2);
        downloadJsFile(jsFile);
      } else if (!fs.existsSync(jsFile)) {
        downloadJsFile(jsFile);
      } else {
        md5File(jsFile, function (err, hash) {
          if (err) {
            writeLog("check MD5 error");
          } else {
            if (hash.toLowerCase() != md5.toLowerCase()) {
              downloadJsFile(jsFile);
            } else {
              step = Steps.GET_DATA;
              prepareFiles(step);
            }
          }
        });
      }

      function downloadJsFile(jsFile) {
        updateScope(
          $scope.ctrlTranslations["loadingView.downloadNewFiles"] + "..."
        );
        url = coinList.jsurl;
        downloadFileInside(url, jsFile);
        function downloadFileInside(file_url, targetPath) {
          req = request({
            method: "GET",
            uri: file_url,
          });

          var out = fs.createWriteStream(targetPath);
          var stream = req.pipe(out);

          //finish downloading
          stream.on("finish", function () {
            var arg = [];
            electron.ipcRenderer.send("main-reload", arg);
          });

          req.on("response", function (data) {
            // Change the total bytes value to get progress later.
          });

          req.on("data", function (chunk) {
            // Update the received bytes
          });

          req.on("error", function (err) {});
        }
      }
    }

    // function checkDaemonFile() {
    //   var version = getToolVersion(getWalletHome(false, currentCoin))
    //   try
    //   {
    //     var currVer = JSON.parse(version)
    //     if(currVer == null || currVer.daemonversion < ver)
    //     {
    //       return true;
    //     }
    //     else
    //     {
    //       return false;
    //     }
    //   }
    //   catch(err) {
    //     writeLog(err);
    //   }
    // }

    function checkWalletStarting() {
      checkDaemon(function (data) {
        if (data.value.errno) {
          //daemon is stopped, reload
          var arg = [];
          electron.ipcRenderer.send("main-reload", arg);
        } else {
          if (!data.value.error ) {
            writeLog("go to finish");
            step = Steps.FINISH;
            prepareFiles(step);
          } else {
            var msg;
            if (
              data.value.error.message.toLowerCase().includes("verifying wallet")
            ) {
              msg = $scope.ctrlTranslations["loadingView.verifyingWallet"];
            } else if (
              data.value.error.message
                .toLowerCase()
                .includes("loading block index")
            ) {
              msg = $scope.ctrlTranslations["loadingView.loadingBlockIdx"];
            } else if (
              data.value.error.message.toLowerCase().includes("verifying blocks")
            ) {
              msg = $scope.ctrlTranslations["loadingView.verifyingBlocks"];
            } else if (
              data.value.error.message.toLowerCase().includes("loading wallet")
            ) {
              msg = $scope.ctrlTranslations["loadingView.loadingWalletDaemon"];
            } else if (
              data.value.error.message.toLowerCase().includes("rescanning")
            ) {
              msg = $scope.ctrlTranslations["loadingView.rescanning"];
            } else if (
              data.value.error.message.toLowerCase().includes("loading addresses")
            ) {
              msg = $scope.ctrlTranslations["loadingView.loadingAddresses"];
            } else if (
              data.value.error.message
                .toLowerCase()
                .includes("rewinding blocks if needed")
            ) {
              msg = $scope.ctrlTranslations["loadingView.rewindingBlocks"];
            }
            if (msg) {
              updateScope(msg);
            }
            if (step != Steps.END) {
              setTimeout(checkWalletStarting, 2000);
            }
          }
        }
      });
    }

    function finishLoading(coin, serverData) {
      writeLog("wallet is started");
      //clearInterval(walletStatusTimer)

      var arg = [coin, serverData];
      electron.ipcRenderer.send("main-execute-timer", arg);
      // if (settings.autoshield) {
      //   electron.ipcRenderer.send("main-execute-shield-all", settings);
      // }
    }

    $scope.closePopup = function () {
      step = Steps.START;
      prepareFiles(step);
    };

    function downloadBlockChain(files, saveFolder) {
      var finishedFile = [];
      if (fs.existsSync(getWalletHome(true) + "/bc_finished.txt")) {
        var data = fs.readFileSync(
          getWalletHome(true) + "/bc_finished.txt",
          "utf8"
        );
        finishedFile = data.replace("\r\n", "\n").split("\n");
      }
      console.log("Finished files", finishedFile);
      var waitingFiles = files;
      if (finishedFile.length > 0) {
        waitingFiles = waitingFiles.filter(
          (e) => !finishedFile.find((ee) => ee == e)
        );
      }
      console.log("Waiting for downloading files", waitingFiles);
      if (waitingFiles.length > 0) {
        var temp = {};
        temp.saveFolder = saveFolder;
        temp.files = waitingFiles;
        ipc.send("main-update-data-splash", {
          type: UpdateDataType.DOWNLOADBLOCKCHAIN,
          data: temp,
        });
      } else {
        step = Steps.START_DAEMON;
        setTimeout(prepareFiles, 2000, step);
      }
    }

    function downloadWallet(ver, detail) {
      spawnMessage(
        MsgType.CONFIRMATION,
        detail == undefined
          ? $scope.ctrlTranslations["loadingView.downloadQuestion"]
          : detail,
        $scope.ctrlTranslations["global.download"],
        $scope.ctrlTranslations["global.version"] +
          " " +
          ver +
          " " +
          $scope.ctrlTranslations["loadingView.isAvailable"]
      );
    }

    function checkParams() {
      writeLog("check params");
      var paramsHome = getParamsHome(serverData);
      var paramFiles = serverData.paramfiles;
      if (paramFiles != null && paramFiles != undefined) {
        var keys = Object.keys(paramFiles);
        var existed = true;
        keys.some(function (element) {
          if (!fs.existsSync(paramsHome + "/" + element)) {
            existed = false;
            return;
          }
        });

        if (!existed) {
          writeLog("file not existed");
          step = Steps.DOWNLOAD_PARAMS;
          prepareFiles(step);
        } else {
          var actions = keys.map(checkHash);
          var results = Promise.all(actions);
          results.then(function (data) {
            if (data.includes(false)) {
              step = Steps.DOWNLOAD_PARAMS;
              prepareFiles(step);
            } else {
              step = Steps.CHECK_DAEMON;
              prepareFiles(step);
            }
          });
        }
      } else {
        step = Steps.CHECK_DAEMON;
        prepareFiles(step);
      }

      function checkHash(element) {
        return new Promise(function (resolve) {
          md5FilePromise(paramsHome + "/" + element).then(function (hash) {
            updateScope(
              $scope.ctrlTranslations["loadingView.checking"] + " " + element
            );
            {
              writeLog("hash = " + hash);
              writeLog("server hash = " + paramFiles[element]);
              if (hash.toLowerCase() != paramFiles[element].toLowerCase()) {
                writeLog("key not correct");
                resolve(false);
              } else {
                resolve(true);
              }
            }
          });
        });
      }
    }

    function checkDaemonFile() {
      writeLog("check daemon");

      if (!fs.existsSync(settings.daemon)) {
        writeLog("file not existed");
        step = Steps.DOWNLOAD_DAEMON;
        prepareFiles(step);
      } else {
        md5File(settings.daemon, function (err, hash) {
          if (err) {
            writeLog("check MD5 error");
          } else {
            var checksum = "";

            if (process.platform == "win32") {
              checksum = serverData.checksum["windowsdaemon"];
            } else if (process.platform == "linux") {
              if (settings.linuxversion == "Ubuntu-16.04") {
                checksum = serverData.checksum["linuxdaemon"];
              } else if (settings.linuxversion == "Ubuntu-18.04") {
                checksum = serverData.checksum["linuxdaemon_18"];
              } else if (settings.linuxversion == "Ubuntu-20.04") {
                checksum = serverData.checksum["linuxdaemon_20"];
              }
            } else if (process.platform == "darwin") {
              checksum = serverData.checksum["macdaemon"];
            }

            writeLog("daemon hash = " + hash);
            writeLog("checksum = " + checksum);

            if (
              checksum == undefined ||
              hash.toLowerCase() != checksum.toLowerCase()
            ) {
              writeLog("daemon checksum is not correct");
              step = Steps.DOWNLOAD_DAEMON;
              prepareFiles(step);
            } else {
              step = Steps.CHECK_DATA_FOLDER;
              prepareFiles(step);
            }
          }
        });
      }
    }

    function autoDownload() {
      settings.autoupdatedaemon = true;
      settings.daemon =
        getWalletHome(false, currentCoin) + "/" + serverData.daemon;
      if (process.platform == "win32") {
        settings.daemon += ".exe";
      }
      saveSettings(settings, currentCoin);
      checkDaemonFile();
    }

    function autoDownloadBlockchain(value) {
      if (value == true) {
        var index = args.findIndex(function (e) {
          return e == "-reindex";
        });
        args.splice(index, 1);
        step = Steps.DOWNLOAD_BLOCKCHAIN;
        prepareFiles(step);
      } else {
        step = Steps.START_DAEMON;
        prepareFiles(step);
      }
    }

    function selectLinux(version) {
      if (version == undefined) {
        $scope.detail.noiticeSelectUbuntu = false;
      } else {
        if (serverData[version] != undefined) {
          settings.linuxversion = version;
          saveSettings(settings, currentCoin);
          var temp = {};
          temp.url = serverData[version];
          temp.saveFolder = getWalletHome(false, currentCoin);
          temp.name = "daemon";
          temp.step = Steps.DOWNLOAD_PARAMS;
          ipc.send("main-update-data-splash", {
            type: UpdateDataType.DOWNLOADFILE,
            data: temp,
          });
        } else {
          //@TODO show select daemon location dialog
          spawnMessage(
            MsgType.DAEMON_LOCATION,
            "",
            "",
            $scope.ctrlTranslations["loadingView.selectBinaryFiles"]
          );
        }
      }
    }

    function daemonAction(errText) {
      //stop wallet
      var dataSend = {};
      if (!errText.includes("Cannot obtain a lock on data directory")) {
        dataSend["status"] = false;
        electron.ipcRenderer.send("main-loading-screen", dataSend);
      } else {
        dataSend["status"] = true;
        electron.ipcRenderer.send("main-loading-screen", dataSend);
      }
    }

    function restartFunction() {
      stopWallet(function () {
        var arg = [];
        electron.ipcRenderer.send("main-reload", arg);
      });
    }

    function start() {
      writeLog("not running");
      updateScope($scope.ctrlTranslations["loadingView.starting"] + "...");
      confData = readConfig(serverData);
      if (confData.rpcuser == undefined) {
        confData["rpcuser"] = makeRandom(30);
        confData["rpcpassword"] = makeRandom(30);
        writeConfig(confData);
      }
      if (confData.testnet == 1) {
        args.push("-testnet");
      }
      if (confData.txindex == undefined && serverData.masternode == true) {
        spawnMessage(
          MsgType.MASTERNODE_OPTION,
          $scope.ctrlTranslations["loadingView.masternodePlan"],
          "",
          " "
        );
      } else {
        if (
          serverData.nodes != undefined &&
          confData.addnode == undefined &&
          serverData.nodes.length > 0
        ) {
          var config = getConfig(serverData);
          serverData.nodes.forEach(function (element) {
            config += "\naddnode=" + element;
          });
          writeConfig(config, true);
        }
        runDaemon();
      }
    }

    function runDaemon() {
      settings = readSettings(currentCoin);
      if (settings.autoupdatedaemon) {
        settings.daemon =
          getWalletHome(false, currentCoin) + "/" + serverData.daemon;
        if (process.platform == "win32") {
          settings.daemon += ".exe";
        }
      }

      if (settings.autostart) {
        autoLauncher.enable();
      } else {
        autoLauncher.disable();
      }

      if (settings.enablelog == undefined) {
        settings.enablelog = true;
      }

      if (settings.transactionschart == undefined) {
        settings.transactionschart = true;
      }

      if (settings.background != undefined) {
        $scope.detail.background = settings.background;
      }
      var arg = [settings, confData, serverData];
      ipc.send("main-update-settings", arg);

      book = readAddressBook(true, serverData, currentCoin);
      arg = [];
      step = Steps.CHECK_WALLET_VERSION;
      prepareFiles(step);
    }

    function dependenciesAction() {
      if (settings.datafolder != undefined) {
        args.push("-datadir=" + settings.datafolder);
      }
      arg = [settings, confData, serverData];
      ipc.send("main-update-settings", arg);
      startWallet(args);
    }

    function cancelNewVersionAction() {
      step = Steps.CHECK_PARAMS;
      prepareFiles(step);
    }

    $scope.openCli = function () {
      var dialogOptions;
      if (process.platform == "win32") {
        dialogOptions = {
          filters: [{ name: "Exe Files", extensions: ["exe"] }],
          properties: ["openFile"],
        };
      } else if (process.platform == "linux" || process.platform == "darwin") {
        dialogOptions = {
          properties: ["openFile"],
        };
      }
      dialog.showOpenDialog(dialogOptions, function (fileNames) {
        if (fileNames === undefined) {
          writeLog("No file selected");
        } else {
          document.getElementById("cli-file").value =
            $scope.detail.cliLocation = fileNames[0];
        }
      });
    };

    function applyLocationAction(location) {
      //@TODO load daemon from new location
      var data = readSettings(currentCoin);
      data["daemon"] = location.replace(/\\/g, "/");
      settings.autoupdatedaemon = false;
      data["autoupdatedaemon"] = false;
      writeLog(JSON.stringify(data));
      saveSettings(data, currentCoin);
      var arg = [];
      electron.ipcRenderer.send("main-reload", arg);
    }

    function noCustomData() {
      settings.datafolder = getUserHome(serverData, undefined);
      saveSettings(settings, currentCoin);
      step = Steps.CHECK_BLOCKCHAIN;
      prepareFiles(step);
    }

    function applyCustomDataAction(location) {
      var data = readSettings(currentCoin);
      data["datafolder"] = location.replace(/\\/g, "/");
      writeLog(JSON.stringify(data));
      saveSettings(data, currentCoin);
      var arg = [];
      electron.ipcRenderer.send("main-reload", arg);
    }

    electron.ipcRenderer.on("child-loading-screen", function (event, msgData) {
      var data = msgData.msg;
      writeLog(data);
      if (data.status == true) {
        step = Steps.OPENING_WALLET;
        prepareFiles(step);
      } else {
        step = Steps.END;
        prepareFiles(step);
      }
    });

    electron.ipcRenderer.on("child-stop-daemon", function (event, msgData) {
      stopDaemon();
    });

    electron.ipcRenderer.on("child-spawn-error", function (event, msgData) {
      spawnMessage(MsgType.LOADING_DAEMON, msgData.msg[0]);
    });

    electron.ipcRenderer.on(
      "child-update-data-loading",
      function (event, msgData) {
        $timeout(function () {
          if (msgData.msg.type == UpdateDataType.SELECTCOIN) {
            currentCoin = msgData.msg.data;
            saveCurrentCoin(currentCoin);

            step = Steps.GET_COIN_LIST;
            prepareFiles(step);
          } else if (msgData.msg.type == UpdateDataType.SELECTCOINSETTINGS) {
            var coin = msgData.msg.data;
            saveCurrentCoin(coin);
            $scope.restartAction();
          } else if (msgData.msg.type == UpdateDataType.DATATYPE) {
            var shouldRestart = false;
            if (
              ((confData["txindex"] == undefined || confData["txindex"] == 0) &&
                msgData.msg.data == true) ||
              (confData["txindex"] &&
                confData["txindex"] == 1 &&
                msgData.msg.data == false)
            ) {
              var walletHome = getWalletHome(true);
              fs.writeFileSync(walletHome + "/commands.txt", "-reindex");
              $scope.restartAction();

              shouldRestart = true;
            }
            confData["txindex"] = msgData.msg.data == true ? 1 : 0;
            writeConfig(confData);
            if (
              serverData.nodes != undefined &&
              confData.addnode == undefined &&
              serverData.nodes.length > 0
            ) {
              var config = getConfig(serverData);
              serverData.nodes.forEach(function (element) {
                config += "\naddnode=" + element;
              });
              writeConfig(config, true);
            }
            if (!shouldRestart) {
              runDaemon();
            }
          } else if (msgData.msg.type == UpdateDataType.CHECKDAEMON) {
            step = Steps.CHECK_DAEMON;
            prepareFiles(step);
          } else if (msgData.msg.type == UpdateDataType.AUTODOWNLOAD) {
            msgData.msg.data == true ? autoDownload() : "";
          } else if (msgData.msg.type == UpdateDataType.APPLYLOCATION) {
            applyLocationAction(msgData.msg.data);
          } else if (msgData.msg.type == UpdateDataType.CUSTOMDATA) {
            msgData.msg.data == false ? noCustomData() : "";
          } else if (msgData.msg.type == UpdateDataType.APPLYCUSTOMDATA) {
            applyCustomDataAction(msgData.msg.data);
          } else if (msgData.msg.type == UpdateDataType.NEWVERSION) {
            cancelNewVersionAction();
          } else if (
            msgData.msg.type == UpdateDataType.AUTODOWNLOADBLOCKCHAIN
          ) {
            autoDownloadBlockchain(msgData.msg.data);
          } else if (msgData.msg.type == UpdateDataType.STARTDAEMON) {
            step = Steps.START_DAEMON;
            setTimeout(prepareFiles, 2000, step);
          } else if (msgData.msg.type == UpdateDataType.DEPENDENCIESACTION) {
            dependenciesAction();
          } else if (msgData.msg.type == UpdateDataType.ERRORDAEMON) {
            daemonAction(msgData.msg.data);
          } else if (msgData.msg.type == UpdateDataType.SELECTLINUX) {
            selectLinux(msgData.msg.data);
          } else if (msgData.msg.type == UpdateDataType.RESTART) {
            setTimeout(restartFunction, 500);
          }
        }, 0);
      }
    );
  },
]);
