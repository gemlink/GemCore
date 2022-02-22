app.controller("ShieldCtrl", [
  "$scope",
  "$http",
  "$timeout",
  "$translate",
  "$rootScope",
  function ($scope, $http, $timeout, $translate, $rootScope) {
    $scope.publicAddresses = [];
    $scope.privateAddresses = [];
    $scope.shieldAddresses = [];
    $scope.detail = {};
    $scope.detail.shieldAddress = undefined;
    // $scope.shieldList = []
    $scope.detail.publicAddr = undefined;
    $scope.detail.privateAddr = undefined;
    $scope.detail.fee = 0.0001;
    $scope.detail.remainingvalue = 0;
    var isShielding = false;
    var continueShieldTimer = undefined;
    $scope.detail.btnEnabled = true;
    $scope.detail.bestTime = -1;
    $scope.detail.lastBestTime = -1;

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
          "global.confirmationTitle",
          "global.success2",
          "sendView.operations.selectSendAddress",
          "sendView.operations.putReceiverAddress",
          "sendView.operations.putTxFee",
          "sendView.operations.checkTxError",
          "shieldView.operations.walletNotSynced",
          "shieldView.operations.shieldAll",
          "shieldView.operations.noCoinToShield",
          "shieldView.operations.multipleShield",
          "shieldView.operations.shieldAllDone",
          "global.errors.NoCoinbaseFundsToShield",
        ]).then((o) => {
          $scope.ctrlTranslations = o;
        });
      });
    };

    $scope.getControllerTranslations();

    function spawnMessage(type, text, title) {
      var arg = [ScreenType.SHIELD, true];
      electron.ipcRenderer.send("main-show-screen", arg);
      $timeout(function () {
        $scope.detail.title =
          title == undefined
            ? $scope.ctrlTranslations["global.alert"] + "!!!"
            : title;
        $scope.detail.text = typeof text == 'string' ? text : JSON.stringify(text, null, 2);
        if (type == MsgType.ALERT) {
          $("#modalShieldAlert").modal();
        } else if (type == MsgType.CONFIRMATION) {
          $("#shieldAllConfirmation").modal();
        }
      }, 0);
    }

    function populateAddress(data) {
      var walletDic = data.from;
      var keys = Object.keys(walletDic);
      $timeout(function () {
        $scope.publicAddresses = [];
        $scope.privateAddresses = [];
        keys.forEach(function (element) {
          var temp = {};
          temp["text"] = element + " - " + walletDic[element].amount;
          temp["value"] = element.split(" (")[0];
          if (element.startsWith("z")) {
            var index = $scope.privateAddresses.findIndex(function (e) {
              return e.text.split(" - ")[0] === temp.text.split(" - ")[0];
            });
            if (index == -1) {
              $scope.privateAddresses.push(temp);
            } else {
              if (
                $scope.privateAddresses[index].text.split(" - ")[1] !=
                temp.text.split(" - ")[1]
              ) {
                $scope.privateAddresses[index].text = temp.text;
              }
            }
          } else {
            var index = $scope.publicAddresses.findIndex(function (e) {
              return e.text.split(" - ")[0] === temp.text.split(" - ")[0];
            });
            if (index == -1) {
              if (walletDic[element].amount > 0) {
                if (walletDic[element].ismine) {
                  $scope.publicAddresses.push(temp);
                }
              }
            } else {
              if (
                $scope.publicAddresses[index].text.split(" - ")[1] !=
                  temp.text.split(" - ")[1] &&
                parseFloat(temp.text.split(" - ")[1]) > 0
              ) {
                $scope.publicAddresses[index].text = temp.text;
              } else if (
                $scope.publicAddresses[index].text.split(" - ")[1] !=
                  temp.text.split(" - ")[1] &&
                parseFloat(temp.text.split(" - ")[1]) == 0
              ) {
                $scope.publicAddresses.splice(index, 1);
              }
            }
          }
        });
      }, 0);
    }

    $scope.selectPubAddress = function (addr) {
      $scope.detail.publicAddr = addr;
    };

    $scope.selectPrivAddress = function (addr) {
      $scope.detail.privateAddr = addr;
    };

    function shieldDone(msg) {
      $timeout(function () {
        spawnMessage(MsgType.ALERT, msg);
        $scope.detail.btnEnabled = true;
      });
    }

    $scope.shieldClick = function () {
      isShielding = true;
      if ($scope.detail.publicAddr == undefined) {
        writeLog("send address = null");
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["sendView.operations.selectSendAddress"]
        );
        return undefined;
      }

      if (
        $scope.detail.privateAddr == undefined ||
        $scope.detail.privateAddr == ""
      ) {
        writeLog("recipient address = null");
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["sendView.operations.putReceiverAddress"]
        );
        return undefined;
      }

      if ($scope.detail.fee == undefined || $scope.detail.fee == "") {
        writeLog("fee = null");
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["sendView.operations.putTxFee"]
        );
        return undefined;
      }

      $scope.detail.btnEnabled = false;
      shieldCoin(
        $scope.detail.publicAddr,
        $scope.detail.privateAddr,
        String($scope.detail.fee).replace(",", "."),
        function (shieldData) {
          isShielding = false;
          if (shieldData.value.error) {
            error_msg = shieldData.value.error.message;
            if (
              error_msg.includes("Could not find any coinbase funds to shield.")
            ) {
              msg =
                $scope.ctrlTranslations[
                  "global.errors.NoCoinbaseFundsToShield"
                ];
            } else {
              msg = error_msg;
            }
            shieldDone(msg);
          } else {
            var opid = shieldData.value.result.opid;
            checkTransaction(opid, function (checkTxData) {
              shieldDone($scope.ctrlTranslations["global.success2"]);
            });
          }
        }
      );
    };

    $scope.shieldAllClick = function () {
      isShielding = true;
      if (
        $scope.detail.privateAddr == undefined ||
        $scope.detail.privateAddr == ""
      ) {
        writeLog("recipient address = null");
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["sendView.operations.putReceiverAddress"]
        );
        return undefined;
      }

      if ($scope.detail.fee == undefined || $scope.detail.fee == "") {
        writeLog("fee = null");
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["sendView.operations.putTxFee"]
        );
        return undefined;
      }

      spawnMessage(
        MsgType.CONFIRMATION,
        $scope.ctrlTranslations["shieldView.operations.shieldAll"] +
          " " +
          $scope.detail.privateAddr,
        $scope.ctrlTranslations["global.confirmationTitle"]
      );
    };

    function shieldAll(to, fee) {
      shieldCoin("*", to, fee, function (shieldData) {
        if (shieldData.value.error) {
          shieldDone(
            $scope.ctrlTranslations["shieldView.operations.shieldAllDone"]
          );
        } else {
          checkTransaction(
            shieldData.value.result.opid,
            function (checkTxData) {
              shieldAll(to, fee);
            }
          );
        }
      });
    }

    $scope.shieldAllAction = function () {
      if ($scope.publicAddresses.length > 0) {
        $scope.detail.btnEnabled = false;
        shieldAll(
          $scope.detail.privateAddr,
          String($scope.detail.fee).replace(",", ".")
        );
      } else {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["shieldView.operations.noCoinToShield"]
        );
      }
    };

    function multipleShield(addr) {
      if (!isShielding && isSynced) {
        isShielding = true;
        $scope.detail.privateAddr = addr;
        $scope.detail.btnEnabled = false;

        shieldCoin(
          $scope.shieldAddresses[0],
          $scope.detail.privateAddr,
          $scope.detail.fee,
          function (shieldData) {
            if (!shieldData.value.error) {
              // check transaction
              var opid = shieldData.value.result.opid;
              checkTransaction(opid, function (checkTxData) {
                multipleShield(addr);
              });
            } else {
              // splice done address, try with the next one
              if (shieldData.value.code == -6) {
                $scope.shieldAddresses.splice(0, 1);
                if ($scope.shieldAddresses.length > 0) {
                  multipleShield(addr);
                } else {
                  // shield done
                  shieldDone(
                    $scope.ctrlTranslations[
                      "shieldView.operations.multipleShield"
                    ]
                  );
                }
              } else {
                shieldDone(
                  $scope.ctrlTranslations[
                    "shieldView.operations.multipleShield"
                  ]
                );
              }
            }
          }
        );
      } else if (!isSynced) {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["shieldView.operations.walletNotSynced"]
        );
      }
    }

    $scope.faq = function () {
      shell.openExternal(
        "https://docs.gemlink.org/wallets/gemcore-wallet/frequently-asked-questions"
      );
    };

    electron.ipcRenderer.on("child-update-shield-address", function (event, msgData) {
      var data = msgData.msg;
      // writeLog(data)
      populateAddress(data);
    });

    electron.ipcRenderer.on(
      "child-execute-multiple-shield",
      function (event, msgData) {
        writeLog(msgData.msg);
        $scope.shieldAddresses = msgData.msg.shieldAddress;
        multipleShield($scope.shieldAddresses);
        //update sending process
      }
    );

    electron.ipcRenderer.on(
      "child-update-locked-coin",
      function (event, msgData) {
        $timeout(function () {
          $scope.detail.remainingvalue = msgData.msg;
        });
      }
    );

    electron.ipcRenderer.on("child-update-loading", function (event, msgData) {
      var data = msgData.msg;
      $timeout(function () {
        $scope.detail.bestTime =
          data.besttime == undefined ? -1 : data.besttime;
      }, 0);
    });
  },
]);
