
angular.module('Browser', ['uiTools'])
.controller('MyData',
['$scope', '$state', '$stateParams', 'MS', '$log',
 'uiTools', '$document', '$timeout', '$mdDialog', '$mdToast',
 'Upload', '$mdSidenav', 'Dialogs',
  function($scope, $state, $stateParams, MS, $log, uiTools, $document,
           $timeout, $dialog,  $mdToast, Upload, $mdSidenav, Dialogs) {

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
                           path: item.path+item.name,
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
    $scope.deleteObj = function(item) {
        MS.deleteObj( path(item.name), item.type ).then(function(res) {
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
        toggleOperations(item);

        $scope.select = true;
        $scope.selected = {type: item.type ? item.type : 'Workspace',
                           path: item.path+item.name,
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
                                      }*/
                                  }]
                              })
                            } else {
                                alert('Server error! Could not upload node.')
                            }
                       })

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
        $timeout(function() {

            if (value.complete == true) {
                console.log('updating')
                $scope.updateDir();
            }
            $scope.status = value;

            console.log('status', $scope.status)
        })

    }, true);


    $scope.showMeta = function(ev, item) {
        Dialogs.showMeta(ev, path(item.name))
    }

    $scope.reconstruct = function(ev, item) {
        Dialogs.reconstruct(ev, item)
    }

    $scope.runFBA = function(ev, item) {
        Dialogs.runFBA(ev, item)
    }

    $scope.gapfill = function(ev, item) {
        Dialogs.gapfill(ev, item)
    }


    function toggleOperations(item) {
        if (item.type === 'model') {
            if (!$mdSidenav('modelOpts').isOpen())
                $mdSidenav('modelOpts').open();

            $document.bind('click', function(e) {
                $mdSidenav('modelOpts').close();
                $document.unbind(e)
            })
        } else if (item.type === 'genome') {
            if (!$mdSidenav('genomeOpts').isOpen())
                $mdSidenav('genomeOpts').open();

            $document.bind('click', function(e) {
                $mdSidenav('genomeOpts').close();
                $document.unbind(e)
            })

        } else if ($mdSidenav('modelOpts').isOpen()) {
            $mdSidenav('modelOpts').close()
        }
    }

    $scope.goTo = function(item) {
        if (item.type === 'folder')
            $state.go('app.myData', {dir: path(item.name)})
        else if (item.type === 'model')
            $state.go('app.modelPage', {path: path(item.name) })
    }
}])

.controller('SideNav',
['$scope', '$mdSidenav',
function($scope, $mdSidenav) {
    $scope.close = function() {
        $mdSidenav('right').toggle();
    }
}])