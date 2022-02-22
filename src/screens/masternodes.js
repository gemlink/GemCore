app.controller("MasternodesCtrl", [
  "$scope",
  "$http",
  "$timeout",
  "$translate",
  "$rootScope",
  function ($scope, $http, $timeout, $translate, $rootScope) {
    $scope.localMNs = [];
    $scope.networkMNs = [];
    $scope.selectedList = [];
    $scope.detail = {};
    $scope.detail.current = {};
    $scope.visible = false;
    $scope.detail.disableActions = true;
    $scope.isSelected = false;

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
          "global.success1",
          "global.fail1",
          "masternodesView.editBtn",
          "masternodesView.operations.duplicateAliasName",
          "masternodesView.operations.duplicatePrivKey",
          "masternodesView.operations.duplicateTxHash",
          "masternodesView.operations.editMnConfirm",
          "masternodesView.operations.notice",
          "masternodesView.operations.copied",
          "masternodesView.operations.deleteMn",
          "masternodesView.operations.mnDetails",
          "global.results.SuccesfullyStartedAlias",
        ]).then((o) => {
          $scope.ctrlTranslations = o;
        });
      });
    };

    $scope.getControllerTranslations();

    function spawnMessage(type, text, title) {
      var arg = [ScreenType.MASTERNODES, true];
      electron.ipcRenderer.send("main-show-screen", arg);
      $timeout(function () {
        $scope.detail.title =
          title == undefined
            ? $scope.ctrlTranslations["global.alert"] + "!!!"
            : title;
        $scope.detail.text = text == 'string' ? text : JSON.stringify(text, null, 2);
        if (type == MsgType.ALERT) {
          $("#modalMasternodesAlert").modal();
        } else if (type == MsgType.CONFIRMATION) {
          $("#modalMasternodesConfirmation").modal();
        } else if (type == MsgType.DELETE) {
          $("#modalMasternodesDelete").modal();
        } else if (type == MsgType.EDITMN) {
          $("#modalMasternodesEdit").modal();
        }
      });
    }

    String.prototype.isEmpty = function () {
      return this.length === 0 || !this.trim();
    };

    function getMNData(timeout) {
      setTimeout(function () {
        getMasternodeList(function (data) {
          console.log("MNData", data);
          populateLocalMN();
          populateNetworkMN(data.value);
        });
      }, timeout);
      setTimeout(getProposal, timeout);
    }

    function populateLocalMN() {
      writeLog("populateLocalMN");
      var data = getMasternodes();
      $scope.localMNs = [];

      if (data != undefined && data != null) {
        data = data.replace("\r\n", "\n");
        var split = data.split("\n");
        split = split.filter(function (v) {
          return !v.isEmpty();
        });

        //@TODO update masternode local list
        var count = 1;
        split.forEach(function (element) {
          var temp = {};
          if (!element.startsWith("# ")) {
            var split2 = element.split(" ");
            split2 = split2.filter(function (v) {
              return v != "";
            });
            if (split2.length >= 5) {
              temp["no"] = count;
              if (split2[0].startsWith("#")) {
                temp["status"] = "No";
                temp["alias"] = split2[0].split("#")[1];
              } else {
                temp["status"] = "Yes";
                temp["alias"] = split2[0];
              }
              var split3 = split2[1].split(":");
              split3.splice(split3.length - 1, 1);
              temp["ip"] = split3.join(":");
              temp["privkey"] = split2[2];
              temp["txhash"] = split2[3];
              temp["outidx"] = split2[4];
              temp["rank"] = "-";
              temp["activetime"] = "-";
              temp["lastseen"] = "-";
              temp["address"] = "-";
              //temp['key'] = temp['outidx']
              count += 1;
            }

            var index = $scope.localMNs.findIndex(function (e) {
              return e.txhash === temp.txhash && e.outidx == temp.outidx;
            });
            if (index == -1) {
              $scope.localMNs.push(temp);
            } else {
              if ($scope.localMNs[index].alias != temp.alias) {
                $scope.localMNs[index].alias = temp.alias;
                $scope.localMNs[index].status = temp.status;
              }
            }
          }
        });
        $scope.localMNs.sort(function (a, b) {
          return a.alias.localeCompare(b.alias);
        });
        localMNs = JSON.parse(angular.toJson($scope.localMNs));
      }
    }

    function countSelected(data) {
      var selectedCount = 0;
      data.forEach(function (element) {
        if (element.status == true) {
          selectedCount += 1;
        }
      });
      return selectedCount;
    }

    function populateNetworkMN(data) {
      //writeLog('total MNs: ' + data.result?.length)
      $scope.networkMNs = [];
      if (data.result) {
        data.result.forEach(function (element) {
          var temp = {};
          temp["rank"] = element.rank;
          temp["ip"] = element.ip;
          temp["txhash"] = element.txhash;
          temp["status"] = element.status;
          temp["addr"] = element.addr;
          temp["version"] = element.version;
          temp["activetime"] = secondsToString(element.activetime);
          temp["lastseen"] = timeConverter(element.lastseen);
          temp["value"] = element;
          temp["outidx"] = element.outidx;
          $scope.networkMNs.push(temp);
        });
      }

      if ($scope.networkMNs.length == 0) {
        getMNData(5000);
      }
      //get masternode list after 30 sec
      else {
        $scope.localMNs.forEach(function (element) {
          var index = $scope.networkMNs.findIndex(function (e) {
            return e.txhash === element.txhash && e.outidx == element.outidx;
          });

          if (index > -1) {
            element.rank = $scope.networkMNs[index].rank;
            element.activetime = $scope.networkMNs[index].activetime;
            element.lastseen = $scope.networkMNs[index].lastseen;
            element.address = $scope.networkMNs[index].addr;
            element.stt = $scope.networkMNs[index].status;
          }
        });
        $scope.detail.masternodeText = " (";
        var enabled = $scope.networkMNs.filter(
          (x) => x.status == "ENABLED"
        ).length;
        var expired = $scope.networkMNs.filter(
          (x) => x.status == "EXPIRED"
        ).length;
        var disabled = $scope.networkMNs.filter(
          (x) => x.status == "DISABLED"
        ).length;

        if (enabled > 0) {
          $scope.detail.masternodeText += enabled + " enabled";
        }
        if (expired > 0) {
          if (enabled > 0) $scope.detail.masternodeText += ", ";
          $scope.detail.masternodeText += expired + " expired";
        }
        if (disabled > 0) {
          if (enabled > 0 || expired > 0) $scope.detail.masternodeText += ", ";
          $scope.detail.masternodeText += disabled + " disabled";
        }

        if (enabled > 0 || expired > 0 || disabled > 0) {
          $scope.detail.masternodeText += ")";
        } else {
          $scope.detail.masternodeText = "";
        }
        electron.ipcRenderer.send("main-localmn-status", $scope.localMNs);
        getMNData(30000);
      }
    }

    $scope.select = function (hash, outidx, privkey) {
      var index = $scope.selectedList.findIndex(
        (e) => e.txhash == hash && e.outidx == outidx
      );
      if (index > -1) {
        $scope.selectedList[index].status =
          $scope.detail.selected[$scope.selectedList[index].privkey];
      } else {
        var temp = {};
        temp.txhash = hash;
        temp.outidx = outidx;
        temp.status = true;
        temp.privkey = privkey;
        $scope.selectedList.push(temp);
      }
      // var keys = Object.keys($scope.selectedList)
      var selectedCount = countSelected($scope.selectedList);
      if (selectedCount > 0) {
        $scope.detail.disableActions = false;
        $scope.detail.disableStart = false;
        if (selectedCount > 1) {
          $scope.detail.disableEdit = true;
        } else {
          $scope.detail.disableEdit = false;
        }
      } else {
        $scope.detail.disableStart = true;
        $scope.detail.disableActions = true;
      }
    };

    $scope.editMasternode = function (isDisabled) {
      writeLog("edit masternode");
      if (!isDisabled) {
        var index = $scope.selectedList.findIndex(function (e) {
          return e.status == true;
        });
        if (index > -1) {
          index = $scope.localMNs.findIndex(function (e) {
            return (
              e.txhash == $scope.selectedList[index].txhash &&
              e.outidx == $scope.selectedList[index].outidx
            );
          });
          $scope.detail.current["alias"] = $scope.detail.current["oldalias"] =
            $scope.localMNs[index].alias;
          $scope.detail.current["ip"] = $scope.localMNs[index].ip;
          $scope.detail.current["privkey"] = $scope.localMNs[index].privkey;
          $scope.detail.current["txhash"] = $scope.localMNs[index].txhash;
          $scope.detail.current["outidx"] = parseInt(
            $scope.localMNs[index].outidx
          );
          spawnMessage(
            MsgType.EDITMN,
            "",
            $scope.ctrlTranslations["masternodesView.editBtn"] +
              " " +
              $scope.localMNs[index].alias
          );
        }
      }
    };

    $scope.editAction = function () {
      writeLog("edit");
      var templocalMNs = bestCopyEver($scope.localMNs);
      $scope.selectedList.forEach(function (element) {
        if (element.status) {
          var index = templocalMNs.findIndex(function (e) {
            return e.txhash == element.txhash && e.outidx == element.outidx;
          });
          if (index > -1) {
            templocalMNs.splice(index, 1);
          }
        }
      });

      index = templocalMNs.findIndex(function (e) {
        return e.alias == $scope.detail.current.alias;
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

      index = templocalMNs.findIndex(function (e) {
        return strstd(e.privkey) == strstd($scope.detail.current.privkey);
      });
      if (index > -1) {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["masternodesView.operations.duplicatePrivKey"]
        );
        return;
      }

      index = templocalMNs.findIndex(function (e) {
        return (
          e.txhash == $scope.detail.current.txhash &&
          e.outidx == $scope.detail.current.outidx
        );
      });
      if (index > -1) {
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["masternodesView.operations.duplicateTxHash"]
        );
        return;
      }

      {
        if ($scope.detail.current.ip.includes(":")) {
          if ($scope.detail.current.ip[0] != "[") {
            $scope.detail.current.ip = "[" + $scope.detail.current.ip + "]";
          }
        }
        editMasternode(
          correctAliasName($scope.detail.current.alias),
          $scope.detail.current.ip,
          $scope.detail.current.privkey,
          $scope.detail.current.txhash,
          $scope.detail.current.outidx,
          true,
          $scope.detail.current.oldalias,
          false,
          $scope.detail.p2pport ? $scope.detail.p2pport : "16113"
        );
        populateLocalMN();
        spawnMessage(
          MsgType.CONFIRMATION,
          $scope.ctrlTranslations["masternodesView.operations.editMnConfirm"],
          $scope.ctrlTranslations["masternodesView.operations.notice"]
        );
      }
    };

    $scope.copyAliasMasternode = function (isDisabled) {
      writeLog("copyAliasMasternode");
      if (!isDisabled) {
        var index = $scope.selectedList.findIndex(function (e) {
          return e.status == true;
        });
        if (index > -1) {
          index = $scope.localMNs.findIndex(function (e) {
            return (
              e.txhash == $scope.selectedList[index].txhash &&
              e.outidx == $scope.selectedList[index].outidx
            );
          });
          var data =
            $scope.localMNs[index].alias +
            " " +
            $scope.localMNs[index].ip +
            ":" +
            ($scope.detail.p2pport ? $scope.detail.p2pport : "16113") +
            " " +
            $scope.localMNs[index].privkey +
            " " +
            $scope.localMNs[index].txhash +
            " " +
            $scope.localMNs[index].outidx;
          copyToClipboard(data);
          spawnMessage(
            MsgType.ALERT,
            $scope.ctrlTranslations["masternodesView.operations.copied"],
            ""
          );
        }
      }
    };

    function copyToClipboard(input) {
      var $temp = $("<textarea>");
      $("body").append($temp);
      $temp.val(input).select();
      document.execCommand("copy");
      $temp.remove();
    }

    $scope.restartAction = function () {
      //stop wallet
      isRestarting = true;
      stopWallet(function () {
        var arg = [];
        electron.ipcRenderer.send("main-reload", arg);
      });
    };

    $scope.copyConfig = function (isDisabled) {
      if (!isDisabled) {
        var data = [];
        data.push("rpcuser=" + makeRandom(40));
        data.push("rpcpassword=" + makeRandom(40));
        data.push("addnode=dnsseed1.gemlink.org");
        data.push("addnode=dnsseed2.gemlink.org");
        data.push("addnode=dnsseed3.gemlink.org");
        data.push("addnode=explorer.gemlink.org");
        data.push("addnode=insight.gemlink.org");
        data.push("addnode=insight.gemlink.org");
        var index = $scope.selectedList.findIndex(function (e) {
          return e.status == true;
        });

        if (index > -1) {
          index = $scope.localMNs.findIndex(function (e) {
            return (
              e.txhash == $scope.selectedList[index].txhash &&
              e.outidx == $scope.selectedList[index].outidx
            );
          });
          data.push(
            "masternodeaddr=" +
              $scope.localMNs[index].ip +
              ":" +
              ($scope.detail.p2pport ? $scope.detail.p2pport : "16113")
          );
          data.push(
            "externalip=" +
              $scope.localMNs[index].ip +
              ":" +
              ($scope.detail.p2pport ? $scope.detail.p2pport : "16113")
          );
          data.push("masternodeprivkey=" + $scope.localMNs[index].privkey);
          data.push("masternode=1");
          data.push("txindex=1");
        }
        data = data.join("\n");
        copyToClipboard(data);
        spawnMessage(
          MsgType.ALERT,
          $scope.ctrlTranslations["masternodesView.operations.copied"],
          ""
        );
      }
    };

    $scope.lockUnlockMasternode = function () {
      writeLog("lockUnlockMasternode");
      if ($scope.selectedList.length >= 2) {
        var status = false;
        $scope.selectedList.forEach(function (element) {
          if (element.status) {
            index = $scope.localMNs.findIndex(function (e) {
              return e.txhash == element.txhash && e.outidx == element.outidx;
            });
            writeLog(JSON.stringify($scope.localMNs[index]));
            if ($scope.localMNs[index].status == "No") {
              status = true;
              return;
            }
          }
        });

        $scope.selectedList.forEach(function (element) {
          if (element.status) {
            index = $scope.localMNs.findIndex(function (e) {
              return e.txhash == element.txhash && e.outidx == element.outidx;
            });
            editMasternode(
              correctAliasName($scope.localMNs[index].alias),
              $scope.localMNs[index].ip,
              $scope.localMNs[index].privkey,
              $scope.localMNs[index].txhash,
              $scope.localMNs[index].outidx,
              status,
              $scope.localMNs[index].alias,
              false,
              $scope.detail.p2pport ? $scope.detail.p2pport : "16113"
            );
          }
        });
        populateLocalMN();
        spawnMessage(
          MsgType.CONFIRMATION,
          $scope.ctrlTranslations["masternodesView.operations.editMnConfirm"],
          $scope.ctrlTranslations["masternodesView.operations.notice"]
        );
      } else if (
        $scope.selectedList.length > 0 &&
        $scope.selectedList.length < 2
      ) {
        var status = false;
        $scope.selectedList.forEach(function (element) {
          if (element.status) {
            index = $scope.localMNs.findIndex(function (e) {
              return e.txhash == element.txhash && e.outidx == element.outidx;
            });
            if ($scope.localMNs[index].status == "No") {
              status = true;
            }
            editMasternode(
              correctAliasName($scope.localMNs[index].alias),
              $scope.localMNs[index].ip,
              $scope.localMNs[index].privkey,
              $scope.localMNs[index].txhash,
              $scope.localMNs[index].outidx,
              status,
              $scope.localMNs[index].alias,
              false,
              $scope.detail.p2pport ? $scope.detail.p2pport : "16113"
            );
          }
        });
        populateLocalMN();
        spawnMessage(
          MsgType.CONFIRMATION,
          $scope.ctrlTranslations["masternodesView.operations.editMnConfirm"],
          $scope.ctrlTranslations["masternodesView.operations.notice"]
        );
      }
    };

    $scope.deleteMasternode = function () {
      var deletedList = "";
      $scope.selectedList.forEach(function (element) {
        if (element.status) {
          var index = $scope.localMNs.findIndex(function (e) {
            return e.txhash == element.txhash && e.outidx == element.outidx;
          });
          deletedList += $scope.localMNs[index].alias + " ";
        }
        deletedList.substring(0, deletedList.length - 2);
      });
      spawnMessage(
        MsgType.DELETE,
        $scope.ctrlTranslations["masternodesView.operations.deleteMn"] +
          ": " +
          deletedList +
          "?",
        $scope.ctrlTranslations["masternodesView.operations.notice"]
      );
    };

    $scope.deletedAction = function () {
      $scope.selectedList.forEach(function (element) {
        if (element.status) {
          var index = $scope.localMNs.findIndex(function (e) {
            return e.txhash == element.txhash && e.outidx == element.outidx;
          });
          removeMasternode(
            $scope.localMNs[index].txhash,
            $scope.localMNs[index].outidx,
            $scope.detail.p2pport ? $scope.detail.p2pport : "16113"
          );
        }
      });
      populateLocalMN();
      spawnMessage(
        MsgType.CONFIRMATION,
        $scope.ctrlTranslations["masternodesView.operations.editMnConfirm"],
        $scope.ctrlTranslations["masternodesView.operations.notice"]
      );
    };

    $scope.viewDetail = function (data) {
      spawnMessage(
        MsgType.ALERT,
        JSON.stringify(data, null, 2),
        $scope.ctrlTranslations["masternodesView.operations.mnDetails"]
      );
    };

    function startOneNode(mn, callback) {
      startMasternode(mn.alias, function (startMNData) {
        writeLog("Startmn data", startMNData);
        if (startMNData.value.result.result == "success") {
          startAlias(mn.alias, function (startAliasData) {
            writeLog("Start alias data", startAliasData);
            var data = startAliasData.value;
            if (data.result) {
              if (data.result.result != "Successfully started alias") {
                var err = {};
                err[mn.alias] = data.result.result;
                callback(err);
              } else {
                var ok = {};
                ok[mn.alias] = $scope.ctrlTranslations["global.results.SuccesfullyStartedAlias"];
                callback(ok);
              }
            } else if (data.error) {
              var err = {};
              err[mn.alias] = data.error.message;
              callback(err);
            }
          });
        } else {
          var err = {};
          err[mn.alias] = startMNData.value.result.error;
          callback(err);
        }
      });
    }

    function start(indexSelected, indexLocal, result, callback) {
      startOneNode($scope.localMNs[indexLocal], function (startOneResult) {
        result.push(startOneResult);
        while (
          indexSelected < $scope.selectedList.length &&
          $scope.selectedList[indexSelected++].status == false
        ) { 
          if($scope.selectedList[indexSelected].status == false) {
            indexSelected++;
          } else {
            break;
          }
        }
        if (indexSelected == $scope.selectedList.length) {
          callback(result);
        } else {
          indexLocal = $scope.localMNs.findIndex(function (element) {
            return (
              element.txhash == $scope.selectedList[indexSelected].txhash &&
              element.outidx == $scope.selectedList[indexSelected].outidx
            );
          });
          start(indexSelected, indexLocal, result, callback);
        }
      });
    }

    $scope.startMasternode = function () {
      writeLog("startMasternode");
      var result = [];
      var index = 0;

      while (
        index < $scope.selectedList.length &&
        $scope.selectedList[index].status == false
      ) {
        index++;
      }
      if (index == $scope.selectedList.length) {
        // show result
        spawnMessage(
          MsgType.ALERT,
          "You haven't choice any masternode",
          $scope.ctrlTranslations["global.fail1"] + "!"
        );
      }
      var indexLocal = $scope.localMNs.findIndex(function (element) {
        return (
          element.txhash == $scope.selectedList[index].txhash &&
          element.outidx == $scope.selectedList[index].outidx
        );
      });

      console.log("Start mn", $scope.selectedList);

      start(index, indexLocal, result, function (data) {
        writeLog("Start result", data);
        spawnMessage(
          MsgType.ALERT,
          data,
          $scope.ctrlTranslations["global.alert"] + "!"
        );
      });
      // startMasternode($scope.localMNs[index].alias, function (startMNData) {
      //   var data = startMNData.value.result;
      //   writeLog(data);
      //   if (data.detail[0].result == "successful") {
      //     var e = $scope.selectedList[0];
      //     var index = localMNs.findIndex(function (element) {
      //       return element.txhash == e.txhash && element.outidx == e.outidx;
      //     });
      //     startAlias($scope.localMNs[index].alias);
      //   } else {
      //     spawnMessage(
      //       MsgType.ALERT,
      //       data.detail[0].error,
      //       $scope.ctrlTranslations["global.fail1"] + "!"
      //     );
      //   }
      // });
    };

    $scope.clearCache = function () {
      //stop wallet
      isRestarting = true;
      stopWallet(function () {
        var loc = getUserHome(serverData, settings) + "/mncache.dat";
        fs.unlinkSync(loc);

        var arg = [];
        electron.ipcRenderer.send("main-reload", arg);
      });
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

    electron.ipcRenderer.on("child-execute-timer", function (event, msgData) {
      writeLog("execute masternode list timer");
      if (serverData.masternode) {
        getMNData(3000);
      }
    });

    // electron.ipcRenderer.on("child-start-alias", function (event, msgData) {
    //   var data = msgData.msg;
    //   if (data.result) {
    //     if (data.result.result != "Successfully started alias") {
    //       spawnMessage(
    //         MsgType.ALERT,
    //         data.result.result,
    //         $scope.ctrlTranslations["global.fail1"] + "!"
    //       );
    //     } else {
    //       spawnMessage(
    //         MsgType.ALERT,
    //         $scope.ctrlTranslations["global.results.SuccesfullyStartedAlias"],
    //         $scope.ctrlTranslations["global.success1"] + "!"
    //       );
    //     }
    //   } else if (data.error) {
    //     spawnMessage(
    //       MsgType.ALERT,
    //       data.error.message,
    //       $scope.ctrlTranslations["global.fail1"] + "!"
    //     );
    //   }
    // });
  },
]);
