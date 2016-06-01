/* 
 * Copyright (C) 2016 Andreas Schultes
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

numFiles=0;



var myApp=angular.module('myApp',[]);

myApp.directive('customOnChange',function(){
    return {
        restrict : 'A',
        link: function(scope,element,attrs){
            var onChangeFunc = scope.$eval(attrs.customOnChange);
            element.bind('change', onChangeFunc);
        }
    };
});



myApp.controller('myController',function($scope,$location){
    $scope.numFiles=numFiles;
    
    $scope.LoadXSPFStatus;
    $scope.LoadMU3Status;
    
    $scope.InfoOptions=[undefined,'Radio','HD'];
    $scope.FECOptions=["12","23","34","56","78","89","35","45","910"];
    $scope.PolarisationOptions=['h','v','l','r'];
    $scope.MSYSOptions=["dvbs","dvbs2"];
    $scope.ROOptions=["0.35","0.25","0.20"];
    $scope.MTypeOptions=["qpsk","8psk"];
    $scope.PLTSOptions=["off","on"];

    $scope.fileNameChanged = function (event){
        $scope.numFiles= event.target.files.length;
        $scope.files=event.target.files;
        $scope.fileContent=[];
        for(var i=0;i<$scope.numFiles;i++)
        {    
            var reader=new FileReader();

            reader.onloadend=function(event){
                if(event.target.readyState==FileReader.DONE){
                    
                    var parser=new DOMParser();
                    var xml=parser.parseFromString(event.target.result,"application/xml");
                    $scope.tracks=xspf_read(xml);
                    $scope.fileContent.push(xml.firstChild);
                     
                    $scope.LoadXSPFStatus="Loaded";
                    $scope.$apply();
                }
            };
            $scope.LoadXSPFStatus="Loading";
            $scope.$apply();
            reader.readAsBinaryString(event.target.files[i]);
       // $scope.files= event.target.files;
        }
    };
    
    $scope.openMU3File =function (event){
        if(event.target.files.length!==1)
        {
            return;
        }
        var reader= new FileReader();
        
        reader.onloadend=function(event){
            if(event.target.readyState==FileReader.DONE){
               var mu3Tracks= mu3_read(event.target.result);
               compareXSPFwithMU3($scope.tracks,mu3Tracks);
               
               $scope.LoadMU3Status="Loaded";
               $scope.$apply(); 
            }
        };
        $scope.LoadMU3Status="Loading";
        $scope.$apply();
        reader.readAsBinaryString(event.target.files[0]);
    };
    
    $scope.moveTrackUp= function(TrackId){
        if(TrackId>0 && TrackId<$scope.tracks.length)
        {
            
            var element=$scope.tracks[TrackId];
            element.index=TrackId-1;
            $scope.tracks.splice(TrackId,1);
            $scope.tracks.splice(TrackId-1,0,element);
            $scope.tracks[TrackId].index=TrackId;
            
        };
    };
    $scope.moveTrackDown= function(TrackId){
        if(TrackId>=0 && TrackId<$scope.tracks.length-1)
        {            
            var element=$scope.tracks[TrackId];
            element.index=TrackId+1;
            $scope.tracks.splice(TrackId,1);
            $scope.tracks.splice(TrackId+1,0,element);
            $scope.tracks[TrackId].index=TrackId;
         
        };
    };
    
    $scope.deleteTrack=function(TrackId){
        $scope.tracks.splice(TrackId,1);
        //now correct indexs
        var i,len=$scope.tracks.length;
        for(i=TrackId;i<len;i++)
            $scope.tracks[i].index=i;                    
    };
    
    $scope.insertTrack=function(TrackId){
        $scope.tracks.splice(TrackId,0,new Object());
        //now correct indexs
        var i,len=$scope.tracks.length;
        for(i=TrackId;i<len;i++)
            $scope.tracks[i].index=i;  
    };
    
    $scope.download=function()
    {
        var filename="senderliste.xspf";
        var content=write_xspf($scope.tracks,filename);
        var blob = new Blob([content], {type: "application/xml"});
        saveAs(blob, filename);
    };
    
    $scope.callVideo=function(TrackId){
        window.location.href=(get_url_from_dvb_parm($scope.tracks[TrackId].location));
    }
});

function compareXSPFwithMU3(xspf,mu3)
{
    if(xspf===undefined || mu3===undefined)
        return;
    var $match=0,$new=0,$mismatch=0;
    var i,lenMU3=mu3.length;
    for(i=0;i<lenMU3;i++){
        var found_track=false;
        var j,lenXSPF=xspf.length;
        for(j=0;j<lenXSPF;j++)
        {
            if(xspf[j].title===mu3[i].name)
            {
                found_track=true;
                if(compare_dvb_parms(xspf[j].location,mu3[i].dvb_parms))
                {
                    xspf[j].compare_status="ok";
                    $match++;
                }
                else
                {
                    xspf[j].compare_status="mismatch";
                    xspf[j].mu3dvb_parms=mu3[i].dvb_parms;
                    $mismatch++;
                }
            }
        }
        if(found_track===false)
        {
            var track_entry=new Object;
            track_entry.title=mu3[i].name;
            track_entry.location=mu3[i].dvb_parms;
            track_entry.compare_status="new";
            track_entry.index=j;
            xspf.push(track_entry);
            $new++;
        }
    }
    xspf.new=$new;
    xspf.match=$match;
    xspf.mismatch=$mismatch;
    xspf.total=xspf.length;
    xspf.old=xspf.length-xspf.new-xspf.mismatch-xspf.match;
}

function compare_dvb_parms(a,b)
{
    if(a.Frequency!==b.Frequency)
        return false;
    if(a.Polarisation!==b.Polarisation)
        return false;
    if(a.MSYS!==b.MSYS)
        return false;
    if(a.SamplingRate!==b.SamplingRate)
        return false;
    if(a.FEC!==b.FEC)
        return false;
    if(a.MTYPE!==b.MTYPE)
        return false;
    if(a.RO!==b.RO)
        return false;
//    if(a.PLTS!==b.PLTS)
//        return false;
    if(a.PID1!==b.PID1)
        return false;
    if(a.PID2!==b.PID2)
        return false;
    if(a.PID3!==b.PID3)
        return false;
    if(a.PID4!==b.PID4)
        return false;
    return true;
}
    


function mu3_read(file)
{
    lines=file.split("\n");
    if(lines[0].indexOf("#EXTM3U")!==0)
        return undefined;
    var i,blockcount,numLines=lines.length;
    var tracks=[]
    for(i=1,blockcount=0;i<numLines-1;i+=2,blockcount++)
    {
        track_entry=new Object;
        track_entry.name=lines[i].slice(lines[i].indexOf(" ")).trim();
        track_entry.dvb_parms=get_dvb_parm_from_url(lines[i+1]);
        tracks[blockcount]=track_entry;
    }
    return tracks;
}

function xspf_read(xmlDocument)
{
    var track_entrys=[];
    var trackListNode=xmlDocument.getElementsByTagName("trackList")[0];
    tracks=trackListNode.children;
    var l=tracks.length;
    for(var i=0;i<l;i++)
    {
        var track_entry=new Object();
        var locationNode=tracks[i].getElementsByTagName("location")[0];
        if(locationNode)
            track_entry.location=get_dvb_parm_from_url(locationNode.textContent);
        var titleNode=tracks[i].getElementsByTagName("title")[0];
        if(titleNode)
            track_entry.title=decodeURIComponent(escape(titleNode.textContent));
        var creatorNode=tracks[i].getElementsByTagName("creator")[0];
        if(creatorNode)
            track_entry.creator=decodeURIComponent(escape(creatorNode.textContent));
        var albumNode=tracks[i].getElementsByTagName("album")[0];
        if(albumNode)
            track_entry.album=decodeURIComponent(escape(albumNode.textContent));
        var infoNode=tracks[i].getElementsByTagName("info")[0];
        if(infoNode)
            track_entry.info=infoNode.textContent;
        var imageNode=tracks[i].getElementsByTagName("image")[0];
        if(imageNode)
            track_entry.image=imageNode.textContent;
        track_entry.track=tracks[i];
        track_entry.index=i;
        track_entrys.push(track_entry);
    }
    return track_entrys;
}

function write_xspf(tracks,name)
{
    var out="<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            +"<playlist version=\"1\" xmlns=\"http://xspf.org/ns/0/\">\n"
            +"\t<title>"+name+"</title>\n"
            +"\t<trackList>\n";
    var numTracks=tracks.length;
    for(var i=0;i<numTracks;i++)
    {
        out+="\t\t<track>\n";
        out+="\t\t\t<location>"+get_url_from_dvb_parm(tracks[i].location).replace(/&(?!amp;)/g,'&amp;')+"</location>\n";
        if(tracks[i].title)
            out+="\t\t\t<title>"+tracks[i].title.replace(/&(?!amp;)/g,'&amp;')+"</title>\n";
        if(tracks[i].creator)
            out+="\t\t\t<creator>"+tracks[i].creator.replace(/&(?!amp;)/g,'&amp;')+"</creator>\n";
        if(tracks[i].album)
            out+="\t\t\t<album>"+tracks[i].album.replace(/&(?!amp;)/g,'&amp;')+"</album>\n";
        if(tracks[i].info)
            out+="\t\t\t<info>"+tracks[i].info+"</info>\n";
        if(tracks[i].image)
            out+="\t\t\t<image>"+tracks[i].image+"</image>\n";
        out+="\t\t</track>\n";
        
    }
    out+="\t</trackList>\n"
    out+="</playlist>\n";
    return out;
}

function get_dvb_parm_from_url(url)
{
    var dvb_parm=new Object();

    var parm_string=url.split('?')[1];
    var parms=parm_string.split('&');
    var parmsLength=parms.length;
    for(var i=0;i<parmsLength;i++)
    {
        var pair=parms[i].split("=");
        if(pair[0]==="freq")
            dvb_parm.Frequency=pair[1];
        if(pair[0]==="pol")
            dvb_parm.Polarisation=pair[1];
        if(pair[0]==="msys")
            dvb_parm.MSYS=pair[1];
        if(pair[0]==="sr")
            dvb_parm.SamplingRate=pair[1];
        if(pair[0]==="fec")
            dvb_parm.FEC=pair[1];
        if(pair[0]==="mtype")
            dvb_parm.MType=pair[1];
        if(pair[0]==="ro")
            dvb_parm.RO=pair[1];
        if(pair[0]==="plts")
            dvb_parm.PLTS=pair[1];
        if(pair[0]==="pids")
        {
            var pids=pair[1].split(",");
            if(pids[2]==="18")
            {
                dvb_parm.PID1=parseInt(pids[3]);
                if(isNaN(dvb_parm.PID1))
                    dvb_parm.PID1=0;
                dvb_parm.PID2=parseInt(pids[4]);
                if(isNaN(dvb_parm.PID2))
                    dvb_parm.PID2=0;
                dvb_parm.PID3=parseInt(pids[5]);
                if(isNaN(dvb_parm.PID3))
                    dvb_parm.PID3=0;
                dvb_parm.PID4=parseInt(pids[6]);
                if(isNaN(dvb_parm.PID4))
                    dvb_parm.PID4=0;
            }
            else
            {
                dvb_parm.PID1=parseInt(pids[2]);
                if(isNaN(dvb_parm.PID1))
                    dvb_parm.PID1=0;
                dvb_parm.PID2=parseInt(pids[3]);
                if(isNaN(dvb_parm.PID2))
                    dvb_parm.PID2=0;
                dvb_parm.PID3=parseInt(pids[4]);
                if(isNaN(dvb_parm.PID3))
                    dvb_parm.PID3=0;
                dvb_parm.PID4=parseInt(pids[5]);
                if(isNaN(dvb_parm.PID4))
                    dvb_parm.PID4=0;
            }    
        }
    }
    return dvb_parm;
}

function get_url_from_dvb_parm(dvb_parm)
{
    var url="rtsp://127.0.0.1:8554/?";
    if(dvb_parm.MSYS==="dvbs"){
        url+="src=1"+"&freq="+dvb_parm.Frequency
            +"&pol="+dvb_parm.Polarisation
            +"&ro=0.35&msys=dvbs&mtype=qpsk&plts=off"
            +"&sr="+dvb_parm.SamplingRate
            +"&fec="+dvb_parm.FEC
            +"&pids=0,17,18";
        if(parseInt(dvb_parm.PID1)!==0)
            url+=","+dvb_parm.PID1;
        if(parseInt(dvb_parm.PID2)!==0)
            url+=","+dvb_parm.PID2;
        if(parseInt(dvb_parm.PID3)!==0)
            url+=","+dvb_parm.PID3;
        if(parseInt(dvb_parm.PID4)!==0)
            url+=","+dvb_parm.PID4;
                
    }
    else
    {
        url+="src=1"+"&freq="+dvb_parm.Frequency
            +"&pol="+dvb_parm.Polarisation
            +"&ro="+dvb_parm.RO
            +"&msys=dvbs2"
            +"&mtype="+dvb_parm.MType
            +"&plts="+dvb_parm.PLTS
            +"&sr="+dvb_parm.SamplingRate
            +"&fec="+dvb_parm.FEC
            +"&pids=0,17,18";
        if(parseInt(dvb_parm.PID1)!==0)
            url+=","+dvb_parm.PID1;
        if(parseInt(dvb_parm.PID2)!==0)
            url+=","+dvb_parm.PID2;
        if(parseInt(dvb_parm.PID3)!==0)
            url+=","+dvb_parm.PID3;
        if(parseInt(dvb_parm.PID4)!==0)
            url+=","+dvb_parm.PID4;
    }
    
    return url;
}

