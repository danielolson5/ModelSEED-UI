
angular.module('Browser', ['uiTools'])
.controller('MyData',
['$scope', '$stateParams', 'MS', '$log',
 'uiTools', '$document', '$timeout', '$mdDialog', '$mdToast', 'Upload',
  function($scope, $stateParams, MS, $log, uiTools, $document, $timeout, $dialog,  $mdToast, Upload) {

    $scope.Upload = Upload;
    $scope.MS = MS;

    $scope.uiTools = uiTools;
    $scope.relativeTime = uiTools.relativeTime;
    $scope.readableSize = uiTools.readableSize;

    // sort by time first
    $scope.predicate = 'timestamp';
    $scope.reverse = true;

    // model: row selection data
    $scope.selected = {};

    // model: when in edit mode
    $scope.edit = false;

    // model: primary click on row
    $scope.select = false;

    // model: items in folder that is being viewed
    $scope.items;


    // Use url in path
    $scope.folder = $stateParams.dir;

    // get path in list form
    var depth = $scope.folder.split('/').length -2;
    $scope.path = $scope.folder.split('/').splice(2, depth);

    // get path strings for parent folders
    var dir_names = $scope.folder.split('/').splice(1, depth);
    var links = [];
    for (var i=0; i < depth; i++) {
        var link = '/'+dir_names.join('/');
        links.push(link);
        dir_names.pop();
    }
    links.reverse();
    links = links.slice(1, links.length);

    // load initial data
    $scope.loading = true;
    MS.getMyData($scope.folder).then(function(data) {
        $scope.items = data;
        $scope.loading = false;
    })

    // method for retrieving links of all parent folders
    $scope.getLink = function(i) {
        return links[i];
    }

    $scope.prevent = function(e) {
        e.stopPropagation();
    }

    // context menu open
    $scope.openMenu = function(e, i, item) {
        console.log('called open row', e, i, item)
        $scope.selected = {type: item.type ? item.type : 'Workspace',
                           name: item.name,
                           index: i};
        console.log('selected item is ', $scope.selected)
    }

    // context menu close
    $scope.closeMenu = function(e, i, item) {
        console.log('called close')
        // if not editing something, remove selection
        if (!$scope.edit) {
            $scope.selected = undefined;
        }
    }

    // used for creating new folder, maybe other things later
    $scope.newPlaceholder = function() {
        console.log('creating new place holder')
        $scope.placeHolder = true;
        $timeout(function() {
            $scope.$broadcast('placeholderAdded');
        })
    }

    // saves the folder name, updates view
    $scope.createFolder = function(name) {
        console.log('creating folder', path(name))
        $scope.placeHolder = false;

        // if nothing entered, return
        if (!name) return;

        $scope.saving = true;
        return MS.createFolder( path(name) ).then(function() {
                   $scope.saving = false;
                   $scope.updateDir();
               }).catch(function(e){
                    console.log('there was an error', e)
                    $scope.saving = false;
               })
    }

    // delete an object
    $scope.deleteObj = function(name) {
        MS.deleteObj( path(name) ).then(function(res) {
            MS.rmFromModel(res[0]);
            $scope.updateDir();
        })
    }

    // used to create editable name
    $scope.editableName = function(selected) {
        $scope.edit = {index: selected.index};

        $timeout(function() {
            $scope.$broadcast('editable');
        })
    }

    // used for rename and move, update view
    $scope.mv = function(src, dest) {
        $scope.selected = undefined;

        $scope.saving = true;
        MS.mv(src, dest).then(function( ){
            $scope.saving = false;
            $scope.edit = false;
            $scope.updateDir();
        }).catch(function(e) {
            console.error('could not save', e)
            $scope.saving = false;
            $scope.edit = false;
        });
    }

    // used for rename and move, update view
    $scope.rename = function(name, new_name) {
        $scope.selected = undefined;

        $scope.saving = true;
        $scope.mv( path(name), path(new_name) );
    }


    $scope.selectRow = function(e, i, item) {
        console.log('called select row', e, i, item)
        $scope.select = true;
        $scope.selected = {type: item.type ? item.type : 'Workspace',
                           name: item.name,
                           index: i};

        e.stopPropagation();
        e.preventDefault();

        // let template update
        $timeout(function() { $document.bind('click', events); })

        // don't interfere with context menu
        function events() {
            $scope.$apply(function() {
                $scope.select = false;
                $scope.selected = undefined;
            })
            $document.unbind('click', events);
        }

        if (item.type != 'folder')
            MS.getDownloadURL(path(item.name))
              .then(function(res) {
                  $scope.selected.downloadURL = res[0];
              })
    }

    // updates the view (bruteforce for now)
    $scope.updateDir = function() {
        MS.getMyData($scope.folder).then(function(data) {
            console.log('data returned', data)
            $scope.items = data;
        })
    }

    // updates the view
    $scope.updateWorkspaces = function() {
        MS.getWorkspaces().then(function(d) {
            $scope.workspaces = d;
            $scope.loading = false;
        })
    }

    function path(name) {
        return $scope.folder+'/'+name;
    }

    $scope.openUploader = function(ev, path) {
        console.log('ev', path)
        $dialog.show({
            targetEvent: ev,
            scope: $scope.$new(),
            preserveScope: true,
            templateUrl: 'app/components/browser/mini-uploader.html',
            controller: ['$scope', function($scope) {
                var $this = $scope;
                $scope.uploadPath = path;   // putting this here there due to onchange issues

                // user selects a type
                $scope.type;

                $scope.createNode = function(files) {

                    // upload to SHOCK
                    /*
                    MS.createNode({path: path+'/'+files[0].name, type:$scope.type})
                      .then(function(res) {
                          $dialog.hide();
                          Upload.uploadFile(files, res[0][11])
                      })
                      .catch(function(e) {
                          if (e.data.error.code == -32603) {
                              $dialog.show({
                                  templateUrl: 'app/vicomponents/browser/confirm.html',
                                  controller: ['$scope', function($scope) {
                                      $scope.cancel = function(){
                                          $dialog.hide();

                                      }
                                      $scope.overwrite = function(name){
                                          $this.createNode(files, true);
                                      }
                                      /*
                                      $scope.keep = function(name){
                                      $this.createNode(files, true);
                                      $dialog.hide();
                                  }
                                  }]
                              })
                            } else {
                                alert('Server error! Could not upload node.')
                            }
                       })*/

                    // Store as file on Server

                    // Check for the various File API support.
                    if (window.File && window.FileReader && window.FileList && window.Blob) {
                        // Great success! All the File APIs are supported.
                    } else {
                        alert('The File APIs are not fully supported in this browser.');
                    }

                    var file = files[0]

                    var reader = new FileReader();
                    reader.readAsText(file, "UTF-8");
                    reader.onload = loadedFile;
                    reader.onerror = errorHandler;

                    function loadedFile(event) {
                        $dialog.hide();

                        var data = event.target.result;
                        MS.uploadData({path: path+'/'+files[0].name,
                                       type: $scope.type,
                                       data: data})
                          .then(function(res) {
                              $this.updateDir();
                              console.log('res', res)
                          })
                    }

                    function errorHandler(event) {
                        alert(event);
                    }
                }

                $scope.cancel = function() {
                    $dialog.hide();
                }
            }]
        })
    }



    // update dropdown after upload
    $scope.$watch('Upload.status', function(value) {
        if (value.complete == true) {

            // clear uploader; fix
            //document.getElementById('upload-form').innerHTML =
            //document.getElementById('upload-form').innerHTML;

            $timeout(function() {
                $scope.status.complete = false;
                $scope.updateDir();
            }, 2000)
        }

        $scope.status = value;

    }, true);


    $scope.reconstruct = function(ev, item) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/reconstruct.html',
            targetEvent: ev,
            scope: $scope.$new(),
            preserveScope: true,
            controller: ['$scope', '$http',
            function($scope, $http) {
                $scope.reconstruct = function(){
                    var name = $scope.selected.name;
                    showToast('Reconstructing', name)
                    MS.reconstruct(item)
                      .then(function(res) {
                           console.log('response', res )
                           showComplete('Reconstruct Complete', name)
                      })
                    $dialog.hide();
                }

                $scope.cancel = function(){
                    $dialog.hide();
                }

            }]
        })
    }

    $scope.runFBA = function(ev, item) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/runFBA.html',
            targetEvent: ev,
            scope: $scope.$new(),
            preserveScope: true,
            controller: ['$scope', '$http',
            function($scope, $http) {

                $scope.reconstruct = function(){
                    var name = $scope.selected.name;
                    showToast('Running Flux Balance Analysis', name)
                    MS.reconstruct(item)
                      .then(function(res) {
                           showComplete('Reconstruct Complete', name)
                      }).catch(function(e) {
                          showError(e.error.message)
                      })
                    $dialog.hide();
                }

                $scope.cancel = function(){
                    $dialog.hide();
                }

            }]
        })
    }

    $scope.gapfill = function(ev, item) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/gapfill.html',
            targetEvent: ev,
            scope: $scope.$new(),
            preserveScope: true,
            controller: ['$scope', '$http',
            function($scope, $http) {

                $scope.gapfill = function(){
                    var name = $scope.selected.name;
                    showToast('Gapfilling', name)
                    MS.gapfill(item)
                      .then(function(res) {
                           showComplete('Gapfill Complete', name)
                      }).catch(function(e) {
                          showError(e.error.message)
                      })
                    $dialog.hide();
                }

                $scope.cancel = function(){
                    $dialog.hide();
                }

            }]
        })
    }

    function showToast(title, name) {
      $mdToast.show({
        controller: 'ToastCtrl',
        //templateUrl:'app/views/dialogs/notify.html',
        template: '<md-toast>'+
                      '<span flex style="margin-right: 30px;">'+
                         '<span class="ms-color">'+title+'</span><br>'+
                         name.slice(0,20)+'...'+'</span>'+
                      '<md-button offset="33" ng-click="closeToast()">'+
                        'Close'+
                      '</md-button>'+
                    '</md-toast>',
        hideDelay: 0,
      });

    };

    function showComplete(title, name) {
        $mdToast.show({
         controller: 'ToastCtrl',
         //templateUrl:'app/views/dialogs/notify.html',
         template: '<md-toast>'+
                         '<span flex style="margin-right: 30px;">'+
                           '<span class="ms-color-complete">'+title+'</span><br>'+
                           name.slice(0,20)+'...'+
                          '</span>'+
                       '<md-button offset="33" ng-click="closeToast()" ui-sref="app.proto">'+
                         'View'+
                       '</md-button>'+
                     '</md-toast>',
         hideDelay: 6000
       });
   }

   function showError(msg) {
       $mdToast.show({
        controller: 'ToastCtrl',
        //templateUrl:'app/views/dialogs/notify.html',
        template: '<md-toast>'+
                        '<span flex style="margin-right: 30px;">'+
                          '<span class="ms-color-error">Error</span><br>'+
                          msg+
                         '</span>'+
                      '<md-button offset="33" ng-click="closeToast()" ui-sref="app.proto">'+
                        'View'+
                      '</md-button>'+
                    '</md-toast>',
        hideDelay: 6000
      });
  }
}])


.controller('ToastCtrl', ['$scope', '$mdToast', '$timeout', function($scope, $mdToast, $timeout) {
  $scope.closeToast = function() {
    $mdToast.hide();
  };


}])
