app.controller("MasternodesConfigCtrl", [
  "$scope",
  "$http",
  "$timeout",
  "$translate",
  "$rootScope",
  function ($scope, $http, $timeout, $translate, $rootScope) {
    var ConfigStatus = { OK: 0, DUPLICATE: 1, FAIL: 2 };
    $scope.detail = {};
    $scope.detail.outputs = [];
    $scope.detail.mnData = [];
    $scope.detail.alias = undefined;
    $scope.detail.ip = undefined;
    $scope.detail.privkey = undefined;
    $scope.detail.transactionID = undefined;
    $scope.detail.index = undefined;

    $scope.detail.showNewMasternodeData = false;
    $scope.detail.btnDisabled = false;

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
          "global.alert",
          "masternodesView.operations.duplicateAliasName",
          "masternodesView.operations.duplicatePrivKey",
          "masternodesView.operations.duplicateTxHash",
          "masternodesView.operations.editMnConfirm",
          "masternodesView.operations.notice",
          "mnsconfigView.MnKey",
          "mnsconfigView.operations.aliasEmpty",
          "mnsconfigView.operations.aliasWhitespace",
          "mnsconfigView.operations.ipEmpty",
          "mnsconfigView.operations.privKeyEmpty",
          "mnsconfigView.operations.txEmpty",
          "mnsconfigView.operations.txIndexEmpty",
          "mnsconfigView.operations.noOutput",
        ]).then((o) => {
          $scope.ctrlTranslations = o;
        });
      });
    };

    $scope.getControllerTranslations();

    function spawnMessage(type, text, title) {
      var arg = [ScreenType.MASTERNODES_CONFIG, true];
      electron.ipcRenderer.send("main-show-screen", arg);
      $timeout(function () {
        $scope.detail.title =
          title == undefined
            ? $scope.ctrlTranslations["global.alert"] + "!!!"
            : title;
        $scope.detail.text = text;
        if (type == MsgType.ALERT) {
          $("#modalMasternodeConfigAlert").modal();
        } else if (type == MsgType.CONFIRMATION) {
          $("#modalMasternodeConfigConfirmation").modal();
        }
      }, 0);
    }

    $scope.select = function (data) {
      console.log("Selected", data);
      console.log($scope.detail.selected);
      if ($scope.detail.selected[data.privkey] == true) {
        var keys = Object.keys($scope.detail.selected);
        keys.forEach((element) => {
          if (element != data.privkey) $scope.detail.selected[element] = false;
          else {
            $scope.detail.privkey = data.privkey;
            $scope.detail.transactionID = data.outidx;
            $scope.detail.index = data.no;
          }
        });
      } else {
        $scope.detail.privkey = undefined;
        $scope.detail.transactionID = undefined;
        $scope.detail.index = undefined;
      }
    };

    function editMasternodeConfig(
      name,
      ip,
      privkey,
      txhash,
      txindex,
      status,
      oldName,
      isNew
    ) {
      writeLog(JSON.stringify(localMNs));
      var tempName = name;
      if (name.startsWith("#")) {
        tempName = name.substring(1);
      }

      var index = localMNs.findIndex(function (e) {
        return e.alias == tempName;
      });
      if (index > -1) {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations[
            "masternodesView.operations.duplicateAliasName"
          ]
        );
        return;
      }

      index = localMNs.findIndex(function (e) {
        return strstd(e.privkey) == strstd(privkey);
      });
      if (index > -1) {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["masternodesView.operations.duplicatePrivKey"]
        );
        return;
      }

      index = localMNs.findIndex(function (e) {
        return e.txhash == txhash;
      });
      if (index > -1) {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["masternodesView.operations.duplicateTxHash"]
        );
        return;
      }

      {
        if (ip.includes(":")) {
          if (ip[0] != "[") {
            ip = "[" + ip + "]";
          }
        }
        editMasternode(
          correctAliasName(name),
          ip,
          privkey,
          txhash,
          txindex,
          status,
          "",
          true,
          $scope.detail.p2pport ? $scope.detail.p2pport : "16113"
        );

        var idx = $scope.detail.mnData.findIndex(e => e.txhash == txhash && e.no == txindex);
        if(idx > -1) {
          $scope.detail.mnData.splice(idx, 1);
        }
        if($scope.detail.mnData.length == 0) {
          spawnMessage(
            MsgType.CONFIRMATION,
            $scope.ctrlTranslations["masternodesView.operations.editMnConfirm"],
            $scope.ctrlTranslations["masternodesView.operations.notice"]
          );
        }
      }
    }

    function finishCreateMNInfo(msg) {
      $timeout(function () {
        $scope.detail.btnDisabled = false;
        spawnMessage(MsgType.ALERT, msg);
      }, 0);
    }

    function createMNInfo(callback) {
      if ($scope.detail.outputs.length > 0) {
        var temp = {};
        var info = $scope.detail.outputs.splice(0, 1)[0];
        temp["txhash"] = info.txhash;
        temp["outidx"] = info.outputidx;
        temp["no"] = $scope.detail.mnData.length + 1;
        getMNPrivKey(function (data) {
          temp["privkey"] = data.value.result;
          $scope.detail.mnData.push(temp);
          if ($scope.detail.outputs.length > 0) {
            createMNInfo(callback);
          } else {
            callback();
          }
        });
      } else {
        callback();
      }
    }

    $scope.generate = function () {
      $scope.detail.showNewMasternodeData = false;
      $scope.detail.btnDisabled = true;
      getMNOutputs(function (outputsData) {
        var data = outputsData.value.result;
        $scope.detail.outputs = [];
        $scope.detail.mnData = [];
        data.forEach(function (element) {
          var index = localMNs.findIndex(function (e) {
            return e.txhash == element.txhash && e.outidx == element.outputidx;
          });
          if (index == -1) {
            $scope.detail.outputs.push(element);
          }
        });

        if ($scope.detail.outputs.length == 0) {
          finishCreateMNInfo(
            $scope.ctrlTranslations["mnsconfigView.operations.noOutput"]
          );
        } else {
          createMNInfo(function () {
            $scope.detail.showNewMasternodeData = true;
            $scope.detail.btnDisabled = false;
          });
        }
      });
    };

    $scope.restartAction = function () {
      //stop wallet
      isRestarting = true;
      stopWallet(function () {
        var arg = [];
        electron.ipcRenderer.send("main-reload", arg);
      });
    };

    $scope.getPrivKey = function () {
      getMNPrivKey(function (data) {
        spawnMessage(
          MsgType.ALERT,
          data.value.result,
          $scope.ctrlTranslations["mnsconfigView.MnKey"]
        );
      });
    };

    $scope.setupMasternode = function () {
      if ($scope.detail.alias == undefined) {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["mnsconfigView.operations.aliasEmpty"]
        );
        return;
      } else if ($scope.detail.alias.includes(" ")) {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["mnsconfigView.operations.aliasWhitespace"]
        );
        return;
      }
      if ($scope.detail.ip == undefined) {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["mnsconfigView.operations.ipEmpty"]
        );
        return;
      }
      if ($scope.detail.privkey == undefined) {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["mnsconfigView.operations.privKeyEmpty"]
        );
        return;
      }
      if ($scope.detail.transactionID == undefined) {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["mnsconfigView.operations.txEmpty"]
        );
        return;
      }
      if ($scope.detail.index == undefined) {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["mnsconfigView.operations.txIndexEmpty"]
        );
        return;
      }

      editMasternodeConfig(
        $scope.detail.alias,
        $scope.detail.ip,
        $scope.detail.privkey,
        $scope.detail.transactionID,
        $scope.detail.index
      );
    };

    $scope.faq = function () {
      shell.openExternal(
        "https://docs.gemlink.org/wallets/gemcore-wallet/frequently-asked-questions"
      );
    };

    electron.ipcRenderer.on("child-update-settings", function (event, msgData) {
      $timeout(function () {
        if (msgData.msg[2] != null && msgData.msg[2] != undefined) {
          $scope.detail.p2pport = msgData.msg[2].p2pport;
        }
      }, 0);
    });
  },
]);
