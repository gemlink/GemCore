app.controller("AddressesCtrl", [
  "$scope",
  "$http",
  "$timeout",
  "$translate",
  "$rootScope",
  function ($scope, $http, $timeout, $translate, $rootScope) {
    $scope.addresses = [];
    $scope.selectedList = {};
    $scope.selectedListClone = {};
    $scope.importList = [];
    $scope.detail = {};
    $scope.privKeyList = {};
    $scope.importData = {};
    $scope.detail.current = {};
    $scope.detail.privKeyText = "";
    $scope.detail.enableButton = true;
    $scope.detail.alertText = "";
    $scope.detail.enableGetPrivKey = false;
    $scope.detail.enableImportKey = true;
    $scope.detail.hideAddress = false;
    $scope.detail.showGetPrivKey = false;
    $scope.detail.sapling = false;
    $scope.detail.hideAddressText = "Hide Address";
    $scope.detail.currentCoin;
    $scope.detail.shieldAddress;
    $scope.detail.importWithRescan = true;
    $scope.detail.isEditing = false;
    $scope.detail.importPrivKeyText = "Import Private Key(s)";

    var isPrivate;
    var isSapling;
    var importingTimer = undefined;
    var countingImport = 1;
    var addrData;
    var newName;
    // $scope.detail.book = readAddressBook(false, serverData, currentCoin)
    // $scope.detail.bookKeys = Object.keys($scope.detail.book)

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
          "global.success",
          "global.fail",
          "global.alert",
          "global.error",
          "global.done",
          "global.confirmationTitle",
          "addressesView.importKeysButton",
          "addressesView.importKeysButtonImporting",
          "addressesView.getAdresses",
          "addressesView.getMultipleAdresses",
          "addressesView.createNewAddressButton",
          "addressesView.createNewPrivateAddressButton",
          "addressesView.addNewAddressBookButton",
          "addressesView.viewAddressBookButton",
          "addressesView.editAddressBookButton",
          "addressesView.operations.keysImportTitle",
          "addressesView.operations.keysImportMsg",
          "addressesView.operations.readOnlyErrTitle",
          "addressesView.operations.readOnlyErrMsg",
          "addressesView.operations.emptyNameErrMsg",
          "addressesView.operations.duplicateNameErrMsg",
          "addressesView.hideAddressButton",
          "addressesView.hideAddressesButton",
          "addressesView.modalMultipleShieldErrMsg",
          "addressesView.modalMultipleShieldConfirmMsg",
          "addressesView.exportMessage",
        ]).then((o) => {
          $scope.detail.privKeyText = o["addressesView.getAdresses"];
          if (
            $scope.detail.importPrivKeyText.startsWith(
              $scope.ctrlTranslations["addressesView.importKeysButtonImporting"]
            ) == false
          ) {
            $scope.detail.importPrivKeyText =
              o["addressesView.importKeysButton"];
          }
          if (countSelected(Object.keys($scope.selectedList)) > 1) {
            $scope.detail.privKeyText = o["addressesView.getMultipleAdresses"];
            $scope.detail.hideAddressText =
              o["addressesView.hideAddressesButton"];
          } else {
            $scope.detail.privKeyText = o["addressesView.getAdresses"];
            $scope.detail.hideAddressText =
              o["addressesView.hideAddressButton"];
          }
          $scope.ctrlTranslations = o;
        });
      });
    };

    $scope.getControllerTranslations();

    var isImport = false;

    function showAlert(id, title, text) {
      var arg = [ScreenType.ADDRESSES];
      $timeout(function () {
        $scope.detail.title = title;
        $scope.detail.alertText =
          typeof text == "string" ? text : JSON.stringify(text, null, 2);
        $(id).modal();
      }, 0);
    }

    function updateAddress(address, newBook) {
      writeLog(newBook);
      var index = $scope.addresses.findIndex(function (e) {
        return e.address == address;
      });
      writeLog(index);
      if (index > -1) {
        $scope.addresses[index].book = newBook;
        $scope.addresses.sort(function (a, b) {
          return a.address[0] >= b.address[0]
            ? a.book
              ? a.book.localeCompare(b.book)
              : true
            : false;
        });
      }
    }

    function updateImportingText() {
      if (countingImport == 1) {
        $scope.detail.importPrivKeyText =
          $scope.ctrlTranslations["addressesView.importKeysButtonImporting"] +
          ".";
        countingImport += 1;
      } else if (countingImport == 2) {
        $scope.detail.importPrivKeyText =
          $scope.ctrlTranslations["addressesView.importKeysButtonImporting"] +
          "..";
        countingImport += 1;
      } else if (countingImport == 3) {
        $scope.detail.importPrivKeyText =
          $scope.ctrlTranslations["addressesView.importKeysButtonImporting"] +
          "...";
        countingImport = 1;
      }
    }

    function populateAddress(data) {
      var walletDic = data.from;
      var keys = Object.keys(walletDic);
      if (keys.length > 0) {
        var count = 1;
        var settings = readSettings($scope.detail.currentCoin);

        var countSelected = 0;
        keys.forEach(function (element) {
          if ($scope.selectedList[element] == true) {
            countSelected += 1;
          }
        });

        if (countSelected >= 1) {
          $scope.detail.showGetPrivKey = true;
          $scope.detail.enableGetPrivKey = true;
        } else {
          $scope.detail.showGetPrivKey = false;
          $scope.detail.enableGetPrivKey = false;
        }
        $timeout(function () {
          $scope.addresses = [];
          keys.forEach(function (element) {
            var temp = {};
            temp["no"] = count;
            temp["copy"] = "";
            var split = element.split(" ");
            temp["address"] = element.split(" ")[0];
            if (split.length > 1) {
              var newbook = element.split(temp["address"] + " ")[1];
              if (newbook.startsWith("(")) {
                newbook = newbook.slice(1, newbook.length - 1);
              }
              if (newbook.endsWith(")")) {
                newbook = newbook.splice(0, newbook.length - 2);
              }
              temp["book"] = newbook;
            }
            var type;
            if (element.startsWith("z")) {
              type = "private";
            } else {
              type = "public";
            }
            if (walletDic[element].ismine == false) {
              type = "read-only";
            }
            temp["type"] = type;
            temp["amount"] = walletDic[element].amount;
            if (
              settings.addresses == undefined ||
              (settings.addresses != undefined &&
                (settings.addresses[temp.address] == true ||
                  settings.addresses[temp.address] == undefined))
            ) {
              $scope.addresses.push(temp);
              var selectedKeys = Object.keys($scope.selectedList);
              var index = selectedKeys.findIndex(function (e) {
                return e === temp.address;
              });

              if (index == -1 && temp.type != "read-only") {
                $scope.selectedList[temp.address] = false;
              }
              count += 1;
            }
          });
          $scope.addresses.sort(function (a, b) {
            return a.address[0] >= b.address[0]
              ? a.book
                ? a.book.localeCompare(b.book)
                : true
              : false;
          });
          $scope.detail.enableButton = true;
          if (!$scope.detail.isEditing) {
            $scope.detail.book = readAddressBook(
              false,
              serverData,
              currentCoin
            );
            $scope.detail.bookKeys = Object.keys($scope.detail.book);
          }
        }, 0);
      }
    }

    function countSelected(keys) {
      var selectedCount = 0;
      keys.forEach(function (element) {
        if ($scope.selectedList[element] == true) {
          selectedCount += 1;
        }
      });
      return selectedCount;
    }

    $scope.deleteBook = function (name, address) {
      var index = $scope.detail.bookKeys.findIndex(function (e) {
        return e == address;
      });
      $scope.detail.bookKeys.splice(index, 1);
      delete $scope.detail.book[address];
    };

    $scope.cancelAddressBookAction = function () {
      $scope.detail.book = readAddressBook(false, serverData, currentCoin);
      $scope.detail.bookKeys = Object.keys($scope.detail.book);
      $scope.detail.isEditing = false;
    };

    $scope.editAddressBookAction = function () {
      editAddressBook($scope.detail.book, serverData, currentCoin);
      electron.ipcRenderer.send("main-update-addressbook", {});
      $scope.detail.isEditing = false;
    };

    $scope.editAddressBook = function () {
      $scope.detail.isEditing = true;
      $scope.detail.book = readAddressBook(false, serverData, currentCoin);
      $scope.detail.bookKeys = Object.keys($scope.detail.book);
      showAlert(
        "#modalEditAddressBook",
        $scope.ctrlTranslations["addressesView.editAddressBookButton"]
      );
    };

    $scope.bookChange = function (newName, address) {
      // writeLog(newName)
      $timeout(function () {
        $scope.detail.book[address] = newName;
        electron.ipcRenderer.send("main-update-addressbook", {});
        // var index = $scope.addresses.findIndex(function(e) {return e.address === address})
        // $scope.addresses[index].book = newName
        //editAddressBook($scope.detail.book, serverData, currentCoin)
        //shouldGetWallet = true
      }, 0);
    };

    $scope.select = function (addr, isSelected) {
      // var index = $scope.addresses.findIndex(function(e) {return e.address === addr})
      // if($scope.addresses[index].type == 'read-only')
      // {
      //   $scope.selectedList[addr] = false
      //   showAlert(
      //     '#modalAddressNoti',
      //     $scope.ctrlTranslations['addressesView.operations.readOnlyErrTitle'],
      //     $scope.ctrlTranslations['addressesView.operations.readOnlyErrMsg']
      //   )
      // }
      // else
      {
        $scope.selectedList[addr] = isSelected;
        var keys = Object.keys($scope.selectedList);
        var count = 0;
        keys.forEach(function (element) {
          if ($scope.selectedList[element] == true) {
            count += 1;
          }
        });

        if (count >= 1) {
          $scope.detail.showGetPrivKey = true;
          $scope.detail.enableGetPrivKey = true;
          if (count >= 2) {
            $scope.detail.privKeyText =
              $scope.ctrlTranslations["addressesView.getMultipleAdresses"];
            $scope.detail.hideAddressText =
              $scope.ctrlTranslations["addressesView.hideAddressesButton"];
          } else {
            $scope.detail.privKeyText =
              $scope.ctrlTranslations["addressesView.getAdresses"];
            $scope.detail.hideAddressText =
              $scope.ctrlTranslations["addressesView.hideAddressButton"];
          }
        } else {
          $scope.detail.showGetPrivKey = false;
        }
      }
    };

    $scope.selectAllClick = function (isSelected) {
      var keys = Object.keys($scope.selectedList);
      keys.forEach(function (element) {
        var index = $scope.addresses.findIndex(function (e) {
          return e.address === element;
        });
        if (index > -1) {
          $scope.selectedList[element] = isSelected;
        }
      });
      if (isSelected && $scope.addresses.length > 0) {
        if ($scope.addresses.length > 1) {
          $scope.detail.privKeyText =
            $scope.ctrlTranslations["addressesView.getMultipleAdresses"];
          $scope.detail.hideAddressText =
            $scope.ctrlTranslations["addressesView.hideAddressesButton"];
        } else {
          $scope.detail.privKeyText =
            $scope.ctrlTranslations["addressesView.getAdresses"];
          $scope.detail.hideAddressText =
            $scope.ctrlTranslations["addressesView.hideAddressButton"];
        }
        $scope.detail.showGetPrivKey = true;
        $scope.detail.enableGetPrivKey = true;
      } else {
        $scope.detail.showGetPrivKey = false;
      }
    };

    $scope.newAddress = function () {
      isPrivate = false;
      showAlert(
        "#modalAddressNewAddress",
        $scope.ctrlTranslations["addressesView.createNewAddressButton"]
      );
    };

    $scope.newPrivateAddress = function (sapling) {
      isPrivate = true;
      isSapling = sapling;
      showAlert(
        "#modalAddressNewAddress",
        $scope.ctrlTranslations["addressesView.createNewPrivateAddressButton"]
      );
    };

    $scope.createAddress = function (event) {
      // console.log($scope.detail.addressName);
      if (event != undefined) {
        event.preventDefault();
        if (event.keyCode === 13) {
          $("#modalAddressNewAddress").modal("hide");
        } else {
          return;
        }
      }

      if (!$scope.detail.addressName) {
        showAlert(
          "#modalAddressNoti",
          $scope.ctrlTranslations["global.fail"],
          $scope.ctrlTranslations["addressesView.operations.emptyNameErrMsg"]
        );
        return;
      }
      var book = readAddressBook(true, serverData, currentCoin);
      var keys = Object.values(book);
      if (keys.includes($scope.detail.addressName)) {
        showAlert(
          "#modalAddressNoti",
          $scope.ctrlTranslations["global.fail"],
          $scope.ctrlTranslations[
            "addressesView.operations.duplicateNameErrMsg"
          ]
        );
        return;
      }
      newName = $scope.detail.addressName;
      $scope.detail.addressName = "";
      $scope.detail.enableButton = false;
      if (isPrivate == false) {
        newAddress(function (newData) {
          $scope.detail.enableButton = true;
          $scope.createAction(newName, newData.value.result);
          shouldGetAll = true;
          showAlert(
            "#modalAddressNoti",
            $scope.ctrlTranslations["addressesView.newAddressButton"],
            newData.value.result
          );
        });
      } else {
        newZAddress(function (newData) {
          $scope.detail.enableButton = true;
          $scope.createAction(newName, newData.value.result);
          shouldGetAll = true;
          showAlert(
            "#modalAddressNoti",
            $scope.ctrlTranslations["addressesView.newAddressButton"],
            newData.value.result
          );
        });
      }
    };

    $scope.getPrivKey = function () {
      $scope.privKeyList = {};
      var keys = Object.keys($scope.selectedList);
      keys.forEach(function (element) {
        if ($scope.selectedList[element] == true) {
          $scope.selectedListClone[element] = true;
        }
      });
      $scope.detail.enableGetPrivKey = false;
      var keys = Object.keys($scope.selectedList);
      privKey(keys[0], function () {
        $scope.detail.privatekeys = JSON.stringify($scope.privKeyList, null, 2);
        $scope.detail.enableGetPrivKey = true;
        $("#privKeyModal").modal();
      });
    };

    $scope.exportToFile = function () {
      exportPrivateKeys("glinkprivkey", function (data) {
        showAlert(
          "#modalAddressNoti",
          $scope.ctrlTranslations["global.done"],
          data.value.result
            ? $scope.ctrlTranslations["addressesView.exportMessage"] +
                data.value.result
            : data.value.error.message
        );
      });
    };

    function privKey(addr, callback) {
      delete $scope.selectedListClone[addr];
      if (!addr.startsWith("z")) {
        exportPrivateKey(addr.split(" ")[0], function (data) {
          // console.log("Export data", data);
          $scope.privKeyList[addr] = data.value.result;
          var keys = Object.keys($scope.selectedListClone);
          if (keys.length > 0) {
            // continue to get
            privKey(keys[0], callback);
          } else {
            callback();
          }
        });
      } else {
        z_exportPrivateKey(addr.split(" ")[0], function (data) {
          // console.log("ZExport data", data);
          $scope.privKeyList[addr] = data.value.result;
          var keys = Object.keys($scope.selectedList);
          if (keys.length > 0) {
            privKey(keys[0], callback);
          } else {
            callback();
          }
        });
      }
    }

    $scope.importPrivKey = function () {
      isImport = true;
      showAlert(
        "#modalAddressNoti",
        $scope.ctrlTranslations["addressesView.operations.keysImportTitle"],
        $scope.ctrlTranslations["addressesView.operations.keysImportMsg"]
      );
    };

    $scope.closeAlertAction = function () {
      if (isImport) {
        $("#importPrivatekeys").modal();
        isImport = false;
      }
    };

    $scope.importAction = function () {
      $scope.importList = $scope.detail.privKeysImport
        .replace(/\r\n/g, "\n")
        .split("\n");
      $scope.detail.privKeysImport = undefined;
      if ($scope.importList.length > 0) {
        if (importingTimer == undefined) {
          importingTimer = setInterval(updateImportingText, 1000);
        }
        importKey();
      }
    };

    $scope.newAddressBook = function () {
      $scope.detail.current.name = "";
      $scope.detail.current.address = "";
      $scope.detail.current.readonly = false;
      showAlert(
        "#modalNewAddressBook",
        $scope.ctrlTranslations["addressesView.addNewAddressBookButton"]
      );
    };

    $scope.viewBook = function (addr, name) {
      $scope.detail.current.name = name;
      $scope.detail.current.address = addr;
      $scope.detail.current.readonly = true;
      showAlert(
        "#modalNewAddressBook",
        $scope.ctrlTranslations["addressesView.viewAddressBookButton"]
      );
    };

    $scope.createAction = function (name, address) {
      $scope.detail.current.address = undefined;
      $scope.detail.current.name = undefined;
      updateAddress(address, name);
      var rtn = addAddressBook(name, address, serverData, currentCoin);
      if (rtn.result == true) {
        book = rtn.book;
      } else {
        //display alert
        showAlert(
          "#modalAddressNoti",
          $scope.ctrlTranslations["global.fail"],
          rtn.error
        );
      }
    };

    function importKey() {
      var priv1 = $scope.importList[0];
      $scope.importList.splice(0, 1);
      // writeLog($scope.importList.length);
      if (priv1.startsWith("K") || priv1.startsWith("L")) {
        importPrivateKey(priv1, function (data) {
          $scope.importData[priv1] = data.value.result;
          continueImport();
        });
      } else {
        z_importPrivateKey(priv1, function (data) {
          $scope.importData[priv1] = data.value.result;
          continueImport();
        });
      }
    }

    function continueImport() {
      if ($scope.importList.length == 0) {
        $scope.detail.enableImportKey = true;
        showAlert(
          "#modalAddressNoti",
          $scope.ctrlTranslations["global.done"],
          $scope.importData
        );
        clearTimeout(importingTimer);
        importingTimer = undefined;
        $scope.detail.importPrivKeyText =
          $scope.ctrlTranslations["addressesView.importKeysButton"];
        return;
      } else {
        $scope.detail.enableImportKey = false;
        importKey();
      }
    }

    $scope.viewQrcode = function (address) {
      var canvas = document.getElementById("qrcode");

      QRCode.toCanvas(canvas, address, { width: 256 }, function (error) {
        if (error) console.error(error);
        showAlert("#modalQrCode", address);
      });
    };

    $scope.hideAddressClick = function () {
      var settings = readSettings($scope.detail.currentCoin);
      if (settings.addresses == undefined) {
        settings.addresses = {};
      }
      var keys = Object.keys($scope.selectedList);
      keys.forEach(function (element) {
        if ($scope.selectedList[element] == true) {
          settings.addresses[element] = false;
          $scope.selectedList[element] = false;
        }
      });
      $scope.detail.selectedAll = false;
      saveSettings(settings, $scope.detail.currentCoin);
      populateAddress(addrData);
      // var arg = [settings]
      // ipc.send('main-update-settings', arg)
    };

    $scope.showAddressClick = function () {
      settings.addresses = {};
      $scope.detail.selectedAll = false;
      saveSettings(settings, $scope.detail.currentCoin);
      populateAddress(addrData);
    };
    $scope.multipleShieldClick = function () {
      if (
        $scope.detail.shieldAddress == null ||
        $scope.detail.shieldAddress == undefined
      ) {
        showAlert(
          "#modalAddressNoti",
          $scope.ctrlTranslations["global.alert"],
          $scope.ctrlTranslations["addressesView.modalMultipleShieldErrMsg"]
        );
      } else {
        showAlert(
          "#shieldAllConfirmationAddr",
          $scope.ctrlTranslations["global.confirmationTitle"],
          $scope.ctrlTranslations[
            "addressesView.modalMultipleShieldConfirmMsg"
          ] +
            " " +
            $scope.detail.shieldAddress
        );
      }
    };

    $scope.shieldAllAction = function () {
      var arg = {};
      arg.privateAddr = $scope.detail.shieldAddress;
      arg.shieldAddress = [];
      var keys = Object.keys($scope.selectedList);
      keys.forEach(function (element) {
        if ($scope.selectedList[element] == true) {
          arg.shieldAddress.push(element);
        }
      });
      electron.ipcRenderer.send("main-execute-multiple-shield", arg);
      //move to shield page
      showTab(ScreenType.SHIELD, false);
      $(window).scrollTop(0);
    };

    electron.ipcRenderer.on("child-update-address", function (event, msgData) {
      addrData = msgData.msg;
      // writeLog(JSON.stringify(data))
      populateAddress(addrData, $scope.detail.hideAddress);
    });

    electron.ipcRenderer.on("child-update-settings", function (event, msgData) {
      $timeout(function () {
        if (msgData.msg[0] != null && msgData.msg[0] != undefined) {
          $scope.detail.hideAddress = msgData.msg[0].hideAddress;
          $scope.detail.shieldAddress = msgData.msg[0].shieldaddress;
          // if($scope.detail.hideZeroAddress == false || $scope.detail.hideZeroAddress == undefined)
          // {
          //   $scope.detail.hideZeroAddressText = $scope.ctrlTranslations['addressesView.hideZeroBalance']
          // }
          // else
          // {
          //   $scope.detail.hideZeroAddressText = $scope.ctrlTranslations['addressesView.showZeroBalance']
          // }
        }
        if (msgData.msg[1] != null && msgData.msg[1] != undefined) {
          $scope.detail.sapling = msgData.msg[2].sapling;
        }
        if (msgData.msg[2] != null && msgData.msg[2] != undefined) {
          $scope.detail.showPrivateAddress = msgData.msg[2].showprivateaddress;
          $scope.detail.shield = msgData.msg[2].shield;
        }
        $scope.detail.currentCoin = currentCoin;
      }, 0);
    });
  },
]);
