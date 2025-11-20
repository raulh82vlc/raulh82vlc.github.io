/*
 * Copyright (c) 2025 Raul Hernandez Lopez
 *
 * This file is part of the project and is licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0).
 *
 * You are free to share and adapt this file under the terms of the CC BY-SA 4.0 license.
 * Full license: https://creativecommons.org/licenses/by-sa/4.0/legalcode
 */

// class which makes mazes
class MazeCreator {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.maze = [];
        this.initMaze();
        this.createMaze();
    }

    initMaze() {
        for (var yCoordinate = 0; yCoordinate < this.height; yCoordinate++) {
            this.maze[yCoordinate] = [];
            for (var xCoordinate = 0; xCoordinate < this.width; xCoordinate++) {
                this.maze[yCoordinate][xCoordinate] = {
                    // first steps is to generate all walls, later removing
                    walls: { top: true, right: true, bottom: true, left: true },
                    // all must be not visited yet before creating its path
                    visited: false
                };
            }
        }
    }

    // uses stack to make iterative backtracking
    // once neighbours and stack are empty the iterative loop stops
    // inspired on https://rosettacode.org/wiki/Maze_generation#JavaScript
    // and http://weblog.jamisbuck.org/2010/12/27/maze-generation-recursive-backtracking
    createMaze() {
        var stack = [];
        var current = { xCoordinate: 0, yCoordinate: 0 };
        this.maze[0][0].visited = true;

        while (true) {
            var neighbours = this.getUnvisitedNeighbours(current);
            
            if (neighbours.length > 0) {
                var next = neighbours[Math.floor(Math.random() * neighbours.length)];
                stack.push(current);
                // removing walls is needed to open paths in the matrix of a maze
                this.removeWallsFromMaze(current, next);
                this.maze[next.yCoordinate][next.xCoordinate].visited = true;
                current = next;
            } else if (stack.length > 0) {
                current = stack.pop();
            } else {
                break;
            }
        }
    }

    getUnvisitedNeighbours(cell) {
        var neighbours = [];
        var xCoordinate = cell.xCoordinate;
        var yCoordinate = cell.yCoordinate;
        // push neighbour
        // when not visited and upper cell was not visited, then is top,
        if (yCoordinate > 0 && !this.maze[yCoordinate - 1][xCoordinate].visited) {
            neighbours.push({ xCoordinate: xCoordinate,
                yCoordinate: yCoordinate - 1,
                direction: 'top' });
        }
        // when not visited amd right cell was not visited, then is right
        if (xCoordinate < this.width - 1 && !this.maze[yCoordinate][xCoordinate + 1].visited){
            neighbours.push({ xCoordinate: xCoordinate + 1,
                yCoordinate: yCoordinate,direction: 'right' });
        }
        // when not visited and bottom cell was not visited, then is right
        if (yCoordinate < this.height - 1 && !this.maze[yCoordinate + 1][xCoordinate].visited) {
            neighbours.push({ xCoordinate: xCoordinate,
                yCoordinate: yCoordinate + 1, direction: 'bottom' });
        }
        // when not visited and left not visited, then is left
        if (xCoordinate > 0 && !this.maze[yCoordinate][xCoordinate - 1].visited) {
            neighbours.push({ xCoordinate: xCoordinate - 1,
                yCoordinate: yCoordinate,direction: 'left' });
        }

        return neighbours;
    }

    // inspired from https://medium.com/swlh/how-to-create-a-maze-with-javascript-36f3ad8eebc1
    removeWallsFromMaze(current, next) {
        // first calculate direction by coordinates x and y
        // from (1,5) to (2,5) is dx: 2-1 = 3, dy: 5-5 = 0 -> right
        // from (2,5) to (1,5) is dx: 1-2 = -1, dy: 5-5 = 0 -> left
        // same with top and bottom
        var xDirection = next.xCoordinate - current.xCoordinate;
        var yDirection = next.yCoordinate - current.yCoordinate;

        if (xDirection === 1) {
            this.maze[current.yCoordinate][current.xCoordinate].walls.right = false;
            this.maze[next.yCoordinate][next.xCoordinate].walls.left = false;
        } else if (xDirection === -1) {
            this.maze[current.yCoordinate][current.xCoordinate].walls.left = false;
            this.maze[next.yCoordinate][next.xCoordinate].walls.right = false;
        } else if (yDirection === 1) {
            this.maze[current.yCoordinate][current.xCoordinate].walls.bottom = false;
            this.maze[next.yCoordinate][next.xCoordinate].walls.top = false;
        } else if (yDirection === -1) {
            this.maze[current.yCoordinate][current.xCoordinate].walls.top = false;
            this.maze[next.yCoordinate][next.xCoordinate].walls.bottom = false;
        }
    }
}